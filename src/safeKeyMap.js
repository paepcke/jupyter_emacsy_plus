/*---------------------- SafeKeyMap Class ------------ */


function SafeKeyMap() {

    var _thisKeyMap = {};
    var _baseMapName = null;
    var _thisKeyMapName = null;
    var savedKeyMaps = []; // Copies of default keymaps
    var savedBindings = {}; // used by suspendKeyBinding()/restoreKeyBinding()

    /*----------------------
      | constructor
      | ----------------- */

    var constructor = function() {
        // nothing for now.
    }
    
    /*----------------------
      | installKeyMap
      | ----------------- */
    
    var installKeyMap = function(newMap, newMapName, baseKeyMapName) {
        /*
          Depending on the value of baseKeyMapName, installs a new
          keymap as a CodeMirror keymap, or 'appends' the new map to an
          existing CodeMirror keymap. CodeMirror keymaps are objects 
          consisting of <keystroke>:<func> pairs. These objects are 
          kept in CodeMirror.keyMap under given names, such as 'macDefault'.
          An additional property 'fallthrough' in each keymap is an array 
          of keymap names. When a keystroke is not found in a keymap, keymaps
          that are named in the map's fallthrough are tried.

          If baseKeyMapName is undefined, the new map is installed standalone.
          Installation means:
          
            - Create a new property named newMapName in the CodeMirror.keyMap 
              object. Make newMap the value of that property.

          If baseKeyMapName is a string, it is expected to be the name of 
          an existing keymap. The new map is 'appended' to that map.

          Appending to an existing keymap means this:

            - Make a new entry newMapName in CodeMirror.keymap, whose value is newMap.
            - Make a copy E' of the existing map E, which is obtained from 
              CodeMirror.keyMap[baseKeyMapName]. Error if the map does not exist.
            - Name the keymap copy "<baseKeyMapName>_<newMapName>" and create a 
              property of that name in CodeMirror.keyMap with a value being the
              copy E'.
            - Remove from E' any keystroke properties that are provided in 
              newMap.
            - Prepend newMapName to the E'.fallthrough array.

          :param newMap: object {<keystroke1> : <function1>, <keystroke2> : <function2>, etc.}
          :type newMap: object
          :param newMapName: the name under which the keymap will be known in CodeMirror.
          :type newMapName: string
          :param baseKeyMapName: if provided this must either be the name of an 
              existing CodeMirror keymap. The corresponding keymap will be found. It
              is an error if the map does not exist. The base keymap is copied. The 
              new keymap is installed as the first fallthrough of that copy. All keys defined in
              the new map are removed from the existing map-copy.
          :return name of new map
          :rtype string
         */
        
        var newStrokes = [];
        var mapName = null;

        if (typeof(newMapName) !== 'string') {
            throw `Name for new map must be a string; was ${typeof(newMapName)}`
        }
          
        if (typeof(baseKeyMapName) === 'undefined') {
            // Easy case: just install the new map, overwriting if exists:
            CodeMirror.keyMap[newMapName] = newMap;
            _thisKeyMap = newMap;
            _thisKeyMapName = newMapName;
            _baseMapName = null;
            return newMapName;
        }

        if (typeof(baseKeyMapName) === 'string') {
            // Get the actual basekeymap object:
            var keymap = CodeMirror.keyMap[baseKeyMapName];
            // Did the map actually exist in CodeMirror?
            if (typeof(keymap) === 'undefined') {
                throw `No keymap '${baseKeyMapName}' found.`;
            }
            // Don't overwrite the existing map; work with a copy
            // Note: the following two are instance vars; so don't
            // declare here. _thisKeyMap is the base map to which
            // we will fall-through the given new map:
            _thisKeyMap = copyKeyMap(keymap);
            _baseMapName = baseKeyMapName;
            _thisKeyMapName = _baseMapName + '_' + newMapName;
        } else {
            // Caller passed an unknown entity as the base map:
            throw "Parameter baseKeyMap must be the name of a keyMap, or must be left out.";
        }

        // Collect an array of keys in the new map
        // (e.g. 'Ctrl-k', 'Shift-q', ...):
        for (var keyStroke in newMap) {
            if (newMap.hasOwnProperty(keyStroke)) {
                newStrokes.push(keyStroke);
            }
        }

        // Remove all keystrokes to be handled in
        // in the new keymap from the old one:
        var tmpMap = copyKeyMap(_thisKeyMap);
        for (var keyStroke in tmpMap) {
            if (newStrokes.indexOf(keyStroke) > -1) {
                delete _thisKeyMap[keyStroke];
            }
        }

        // Install the new keymap as the fallthrough
        // map of the existing map: 
        var fallthroughKeyMaps = _thisKeyMap.fallthrough;
        if (typeof(fallthroughKeyMaps == 'undefined')) {
            fallthroughKeyMaps = [newMapName];
        } else if (! newMapName in fallthroughKeyMaps) {
            // Make new map the first in the fallthrough:
            fallthroughKeyMaps.unshift(newMapName);
        }
        _thisKeyMap.fallthrough = fallthroughKeyMaps;
          
        CodeMirror.keyMap[newMapName] = newMap;
        CodeMirror.keyMap[_thisKeyMapName] = _thisKeyMap;
        return _thisKeyMapName;
    }

    /*----------------------
      | activateKeyMap
      | ----------------- */

    var activateKeyMap = function(keyMapName) {
        /* 
           Finds keymap of given name in CodeMirror.keyMap.
           Error if not found. Pushes the existing
           CodeMirror.keyMap.default keymap onto the saved-keymaps
           stack, and sets CodeMirror.keyMap.default to the
           new keymap.
          
           :param keyMapName: name of existing keyMap.
           :type keyMapName: string.
        */
          
        var keyMap = CodeMirror.keyMap[keyMapName];
        if (typeof(keyMap) === 'undefined') {
            throw `Keymap ${keyMapName} does not exist.`;
        }
        // Save current default map's copy on stack:
        savedKeyMaps.push(copyKeyMap(CodeMirror.keyMap.default));
        CodeMirror.keyMap.default = keyMap;
    }

    /*----------------------
      | deactivateKeyMap
      | ----------------- */

    var deactivateKeyMap = function() {
        // Removes the most recently saved keymap from the
        // saved-keymps stack, and installs it as the CodeMirror.keyMap.default
        // keymap. If the stack is empty, leaves the default map
        // unchanged and returns undefined. Else returns the re-instated
        // keymap:

        var keyMap = this.savedKeyMaps.pop();
        if (typeof(keyMap) !== 'undefined') {
            CodeMirror.keyMap.default = keyMap;
        }
        return keyMap;
    }

    /*----------------------
      | registerCommand
      | ----------------- */

    var registerCommand = function(cmdName, func, overwrite) {
        /*
          Adds command function to CodeMirror.commands object.
          If overwrite is set to true, then any function already
          registered in the object under cmdName is overwritten.
          Otherwise a error is raised if the cmdName is already
          a key in CodeMirror.commands.

          Once a command is registered it can be used in keymaps,
          where it can be mentioned by name as the value of a
          keystroke-func property.

          :param cmdName: name under which the function is registered.
          :type cmdName: string
          :param func: a function taking one argument: a CodeMirror
             editor instance.
          :type func: function.
          :param overwrite: if provided and has the value true, existing
             function registered under cmdName is overwritten. Else 
             error thrown if command name is registered.
         */
        var existingCmd = CodeMirror.commands[cmdName];
        if (typeof(existingCmd) === 'undefined') {
            CodeMirror.commands[cmdName] = func;
            return;
        }
        if (overwrite !== true) {
            throw `Command ${cmdName} already exists, and parameter overwrite was not set to true.`;
        }
        CodeMirror.commands[cmdName] = func;
    }

    /*----------------------
      | cmdFromName
      | ----------------- */

    var cmdFromName = function(funcName) {
        /*
          Given a command name, return the corresponding function.
          This works only if the command has been registered
          using registerCommand(). If command not found,
          returns undefined.
         */
        
        return CodeMirror.commands[funcName];
    }
    

    /*----------------------
      | getNextChar
      | ----------------- */
    
    var getNextChar = function(cm, preventDefault) {

        /*
          Returns a JavaScript promise that will yield the next
          char that the user typed in. Usage:

          <SafeKeyMap-Instance>.getNextChar().then(function(nxtChr, trueChr) {
             alert("Key was: '" + nxtChr + "'");
             })

          The nxtChr will be the typed character without modifiers: 'a', 'R', ...
          The trueChr will include the modifier: 'Ctrl-a', 'Alt-R'.

          :param preventDefault: if true, the effect that the incoming character 
              usually has, such as appearing on the display, will be suppressed.
              Else the char will have its usual effect in the editor. Default
              is to prevent.
          :type preventDefault: boolean

         */

        if (typeof(preventDefault) === 'undefined') {
            preventDefault = true;
        }
        var lookAheadHandler = null;
        var nxtKeyPromise = new Promise(function(resolve, reject) {
            lookAheadHandler = function(cm, event) {
                var followingKey = event.key;
                var trueKey = null; // Ctrl-X, Alt-Y, etc
                if (preventDefault) {
                    event.preventDefault();
                }
                cm.off('keypress', lookAheadHandler);
                if (event.ctrlKey) {
                    trueKey = 'Ctrl-' + followingKey;
                } else if (event.altKey) {
                    trueKey = 'Alt-' + followingKey;
                } else if (event.shiftKey) {
                    trueKey = 'Shift-' + followingKey;
                } else {
                    trueKey = followingKey;
                }
                resolve(trueKey);
            }
        })
        cm.on('keypress', lookAheadHandler);
        return nxtKeyPromise;
    }
    
    /*----------------------
      | getKeyBinding
      | ----------------- */

    var getKeyBinding = function(keystroke) {
        /* 
           Given a keystroke such 'a', 'Ctrl-B', etc, 
           return the command bound to that keystroke.
           The top-level map is searched first. Then 
           all the fallthrough maps in order. Returns
           the bound command or undefined.

           :param keystroke: keystroke whose relevant keymap is to be found.
           :type keystroke: string
           :returns command bound to keystroke, or undefined.
           :rtype {function | undefined}
        */
        var relevantMap = getRelevantKeyMap(keystroke);
        if (typeof(relevantMap) != 'undefined') {
            return relevantMap[keystroke];
        }
        return undefined;
    }

    /*----------------------
      | setKeyBinding
      | ----------------- */

    var setKeyBinding = function(keystroke, cmd) {

        var relevantMap = getRelevantKeyMap(keystroke);
        if (typeof(relevantMap) === 'undefined') {
            // Set in top-level keymap:
            relevantMap = _thisKeyMap;
        }
        releventMap[keystroke] = cmd;
    }
    

    /*----------------------
      | deleteKeyBinding
      | ----------------- */

    var deleteKeyBinding = function(keystroke) {
        var relevantMap = getRelevantKeyMap(keystroke);
        if (typeof(relevantMap) === 'undefined') {
            // Key not bound in the first place:
            return;
        }
        delete relevantMap[keystroke];
    }
    

    /*----------------------
      | suspendKeyBinding
      | ----------------- */

    var suspendKeyBinding = function(keystroke) {
        var relevantMap = getRelevantKeyMap(keystroke);
        if (typeof(relevantMap) === 'undefined') {
            throw `Called suspendKeyBinding() with unbound key ${keystroke}`;
        }
        savedBindings[keystroke] = {map : relevantMap, cmd : relevantMap[keystroke]};
        deleteKeyBinding(keystroke);
    }
    

    /*----------------------
      | restoreKeyBinding
      | ----------------- */

    var restoreKeyBinding = function(keystroke) {
        /*
          Assumes that savedBindings is:
            {keystroke1 : {map : <relevantKeyMap1>, cmd : <command1>},
             keystroke2 : {map : <relevantKeyMap2>, cmd : <command2>}
             }
        */
        var savedBinding = savedBindings[keystroke];
        if (typeof(savedBinding) != 'undefined') {
            savedBinding.map[keystroke] = savedBinding.cmd;
            // Forget the suspension:
            delete savedBinding[keystroke];
        } else {
            throw `Called restoreKeyBinding(${keystroke}) without prior suspendKeyBinding()`;
        }
    }


    /*----------------------
      | value
      | ----------------- */

    var value = function() {
        /* Return the actual keymap object */
        return _thisKeyMap;
    }
          
    /*----------------------
      | name
      | ----------------- */

    var name = function() {
        /* Getter for name of this keymap as known in CodeMirror.keyMap */
        
        return _thisKeyMapName;
    }

    
    /*----------------------
      | baseMapName
      | ----------------- */

    var baseMapName = function() {
        /* Getter for name of map on which this keymap is based. */
        
        return _baseMapName;
    }

    /*----------------------
      | getOsPlatform
      | ----------------- */

    var getOsPlatform = function() {
        /*
          Best guess as to OS under the browser. Returns
          Mac, Linux, Windows, or Unknown.
         */

        if (navigator.platform.indexOf('Mac') > -1) {
            return 'Mac';
        } else if (navigator.platform.indexOf('Linux') > -1) {
            return 'Linux';
        } else if (navigator.platform.indexOf('Win') > -1) {
            return 'Windows';
        } else {
            return 'Unknown';
        }
    }


    /*----------------------
      | copyKeyMap
      | ----------------- */

    var copyKeyMap = function(keymap) {
        var newMap = {};
        for (var keyStroke in keymap) {
            newMap[keyStroke] = keymap[keyStroke];
        }
        return newMap;
    }
          
    /*----------------------
      | getRelevantKeyMap
      | ----------------- */

    var getRelevantKeyMap = function(keystroke) {
        /*
          Given a keystroke, return the keymap that
          defines that key. The top-level keymap is
          tried first. Then the fallthrough keymaps 
          in order.

          :param keystroke: keystroke whose relevant keymap is to be found.
          :type keystroke: string
          :returns keymap object or undefined.
           :rtype {object | undefined}
         */
        
        var cmd = _thisKeyMap[keystroke];
        if (typeof(cmd) != 'undefined') {
            // Key was in the main part of the map (not the fallthrough):
            return _thisKeyMap;
        }
        // Check the fallthrough maps in order:
        for (let mapName of _thisKeyMap.fallthrough) {
            var map = CodeMirror.keyMap[mapName];
            if (typeof(map) != 'undefined') {
                var cmd = map[keystroke];
                if (typeof(cmd) != 'undefined') {
                    return map;
                }
            }
        }
        return undefined;
        
    }

/* ---------------------------- Call the Constructor and Export Public Methods ---------------- */          

    // Call the constructor:
    constructor();
    return {
        value : value,
        name : name,
        baseMapName : baseMapName,
        installKeyMap : installKeyMap,
        activateKeyMap : activateKeyMap,
        deactivateKeyMap : deactivateKeyMap,
        registerCommand : registerCommand,
        cmdFromName : cmdFromName,
        getNextChar : getNextChar,
        getKeyBinding : getKeyBinding,
        setKeyBinding : setKeyBinding,
        deleteKeyBinding : deleteKeyBinding,
        suspendKeyBinding : suspendKeyBinding,
        restoreKeyBinding : restoreKeyBinding,
        getOsPlatform : getOsPlatform
        // copyKeyMap : copyKeyMap
    }
} // end class Savedkeymaps

/*------------------------------- Keymap Class Creation and Util Func  -------------- */




