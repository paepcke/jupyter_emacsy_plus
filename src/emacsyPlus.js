
function EmacsyPlus() {

    var km = new SafeKeyMap();
    var emacsyPlusMap = {};
    var ctrlXMap = {};

    var constructor = function() {
    
        km.registerCommand('ctrlXCmd', ctrlXCmd, true);  // true: ok to overwrite function
        km.registerCommand('killCmd', killCmd, true);  // true: ok to overwrite function
        km.registerCommand('yankCmd', yankCmd, true) // true: ok to overwrite function
        km.registerCommand('copyCmd', copyCmd, true) // true: ok to overwrite function
        km.registerCommand('saveToRegCmd', saveToRegCmd, true) // true: ok to overwrite function
        km.registerCommand('insertFromRegCmd', insertFromRegCmd, true) // true: ok to overwrite function

        var mapName = km.installKeyMap(buildEmacsyPlus(), 'emacsy_plus', 'macDefault');
        km.activateKeyMap(mapName);
        //********
        //alert('Activated ' + mapName);
        //********        

    }
    
    /*------------------------------- Build/Install/Activate the Emacsy-Plus Keymap Object  -------------- */    

    var buildEmacsyPlus = function() {
        /*
          Build the keystroke/command object for Emacs-like
          behavior. Note that you need to create each command
          as a method, and must register it in the constructor,
          unless it already exists in CodeMirror as a command
          (https://codemirror.net/doc/manual.html). See function
          'constructor' for examples.

          Also constructs the secondary cnt-x keymap. It maps
          cnt-x <?> keystrokes to corresponding commands. This
          map is stored in an instance variable only; it is not
          returned.

          :returns top-level keystroke->command map
          :rtype {str : str}.
         */
        
        emacsyPlusMap['Ctrl-X'] = "ctrlXCmd";  // cnt-x <?> --> processed further via ctrlXMap
        emacsyPlusMap['Ctrl-K'] = "killCmd";
        emacsyPlusMap['Cmd-W']  = "copyCmd";
        emacsyPlusMap['Ctrl-Y'] = "yankCmd";
        emacsyPlusMap['Ctrl-A'] = "goLineStart";
        emacsyPlusMap['Ctrl-E'] = "goLineEnd";
        emacsyPlusMap['Ctrl-P'] = "goLineUp";
        emacsyPlusMap['Ctrl-N'] = "goLineDown";
        emacsyPlusMap['Ctrl-D'] = "delCharAfter";
        emacsyPlusMap['Ctrl-T'] = "transposeChars";
        emacsyPlusMap['Ctrl-V'] = "goPageUp";
        emacsyPlusMap['Cmd-V']  = "goPageDown";
        emacsyPlusMap['Cmd-B']  = "goWordLeft";
        emacsyPlusMap['Cmd-F']  = "goWordRight";

        // Now the cnt-X 'secondary' keymap:
        ctrlXMap['x'] = "saveToRegCmd";
        ctrlXMap['g'] = "insertFromRegCmd";

        return emacsyPlusMap;
    }

    var insertTxt = function(cm, txt) {
        /* Inserts text in a CodeMirror editor at cursor 
           
           :param cm: CodeMirror editor instance
           :type cm: CodeMirror
           :param txt: text to insert
           :type txt: string

        */
        
        var cursor = cm.doc.getCursor();
        cm.doc.replaceRange(txt, cursor);
    }

    var multiKillCheck = function(cm, keystroke, event) {
        /*
          Handler called when keys are pressed or mouse is clicked.
          Active only while successive cnt-K's have not been interrupted
          by any other key press. This allows multiple cnt-Ks to 
          kill multiple lines, stringing them together for later
          yank.

        */
        if (keystroke !== 'Ctrl-K') {
            CodeMirror.emacsArea.multiKillInProgress = false;
            cm.off('keyHandled', multiKillCheck);
            cm.off('mouseDown', multiKillCheck);
        }
    }

    /*------------------------------- Commands for CodeMirror  -------------- */

    var ctrlXCmd = function(cm) {
        /* Handling the cnt-X family of keys. Called whenever Cntl-K
           is pressed. Function waits for the next char to determine
           which cnt-x command is intended. Then dispatches for
           further handling.

           :param cm: CodeMirror instance
           :type cm: CodeMirror
        */    
        km.getNextChar(cm).then(function(cntXKey) {
            /*
              Once the promise is fulfilled, it will deliver the
              cnt-x command to run. E.g. the 'g' in 'Cnt-x g'.
              If the cntrlXMap has an entry for 'g', the value
              will be a function that will take one arg: the 
              CodeMirror editor object cm.
             */

            // Get name of handler function:
            var handlerName = ctrlXMap[cntXKey]
            if (typeof(handlerName) === 'undefined') {
                return;
            }
            var handler = km.cmdFromName(handlerName);
            if (typeof(handler) === 'undefined') {
                return;
            }
            handler(cm);
        });
    }

    var saveToRegCmd = function(cm) {
        /* NOTE: called from ctrlXCmd() handler 
           Save current selection (if any) in register. 
           Waits for following char as the register name.
        */
        if (cm.somethingSelected()) {
            var selectedTxt = cm.getSelection();
            // Grab the next keystroke, which is
            // the register name:
            km.getNextChar(cm).then(function (regName) {
                CodeMirror.emacsArea.registers[regName] = selectedTxt;
            })
        }
    }

    var insertFromRegCmd = function(cm) {
        /* NOTE: called from ctrlXCmd() handler 
           Inserts content of register at current cursor.
           Waits for following char as the register name.
        */
        
        // Grab the next keystroke, which is
        // the register name:
        
        km.getNextChar(cm).then(function (regName) {
            insertTxt(cm, CodeMirror.emacsArea.registers[regName]);
        })
    }

    var copyCmd = function(cm) {
        /*
          If anything is selected, copy it to CodeMirror.emacsArea.killedTxt.
          The yankCmd knows to find it there.

           :param cm: CodeMirror instance
           :type cm: CodeMirror
         */
        if (cm.somethingSelected()) {
            var selectedTxt = cm.getSelection();
            CodeMirror.emacsArea.killedTxt = selectedTxt;
        }
    }

    var killCmd = function(cm) {
        /* cnt-K: kill to end of line and keep content in cut buffer 

           :param cm: CodeMirror instance
           :type cm: CodeMirror
        */
        
        var curLine   = cm.doc.getCursor().line;
        var curChr    = cm.doc.getCursor().ch;
        var line      = cm.doc.getLine(curLine);

        if (! CodeMirror.emacsArea.multiKillInProgress) {
            CodeMirror.emacsArea.killedTxt = "";
        }
        
        var killTxt   = line.substring(curChr);
        if (killTxt.length === 0) {
            cm.execCommand('deleteLine');
            killTxt = '\n';
        } else {
            cm.execCommand('delWrappedLineRight');
        }

        CodeMirror.emacsArea.killedTxt += killTxt;
        cm.on('keyHandled', multiKillCheck);
        cm.on('mouseDown', multiKillCheck);
        CodeMirror.emacsArea.multiKillInProgress = true;
        return false;
    }

    var yankCmd = function(cm) {
        /* Insert cut buffer at current cursor.

           :param cm: CodeMirror instance
           :type cm: CodeMirror
        */
        
        var killedTxt = CodeMirror.emacsArea.killedTxt;
        insertTxt(cm, killedTxt);
        return false;
    }

    /* ----------------------------  Call Constructor and Export Public Methods ---------- */

    constructor();

    // There are no public instance variables or methods: 
    return {}

} // end class EmacsyPlus
