
function EmacsyPlus() {

    var km = new SafeKeyMap();
    var emacsyPlusMap = {};
    var ctrlXMap = {};
    var mark = null;

    var constructor = function() {
    
        km.registerCommand('ctrlXCmd', ctrlXCmd, true);  // true: ok to overwrite function
        km.registerCommand('killCmd', killCmd, true);
        km.registerCommand('killRegionCmd', killRegionCmd, true)        
        km.registerCommand('yankCmd', yankCmd, true)
        km.registerCommand('copyCmd', copyCmd, true)
        km.registerCommand('setMarkCmd', setMarkCmd, true)
        km.registerCommand('selPrevCharCmd', selPrevCharCmd, true)
        km.registerCommand('selNxtCharCmd', selNxtCharCmd, true)                
        km.registerCommand('selNxtWordCmd', selNxtWordCmd, true)
        km.registerCommand('selPrevWordCmd', selPrevWordCmd, true)
        km.registerCommand('delWordAfterCmd', delWordAfterCmd, true)
        km.registerCommand('delWordBeforeCmd', delWordBeforeCmd, true)        
        km.registerCommand('saveToRegCmd', saveToRegCmd, true)
        km.registerCommand('insertFromRegCmd', insertFromRegCmd, true)
        km.registerCommand('cancelCmd', cancelCmd, true)
        km.registerCommand('xchangePtMarkCmd', xchangePtMarkCmd, true)

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
        
        /*-------------- Emacs Keymap -------------*/

        emacsyPlusMap['Ctrl-X'] = "ctrlXCmd";  // cnt-x <?> --> processed further via ctrlXMap

        emacsyPlusMap['Ctrl-K'] = "killCmd";
        emacsyPlusMap['Ctrl-W'] = "killRegionCmd";
        emacsyPlusMap['Alt-W']  = "copyCmd";
        emacsyPlusMap['Ctrl-Y'] = "yankCmd";

        emacsyPlusMap['Ctrl-A'] = "goLineStart";
        emacsyPlusMap['Ctrl-E'] = "goLineEnd";
        emacsyPlusMap['Ctrl-P'] = "goLineUp";
        emacsyPlusMap['Up']     = "goLineUp";
        emacsyPlusMap['Ctrl-N'] = "goLineDown";
        emacsyPlusMap['Down']   = "goLineDown";
        emacsyPlusMap['Ctrl-B'] = "goCharLeft";
        emacsyPlusMap['Left']   = "goCharLeft";        
        emacsyPlusMap['Ctrl-F'] = "goCharRight";
        emacsyPlusMap['Right']  = "goCharRight";        
        emacsyPlusMap['Ctrl-V'] = "goPageUp";
        //emacsyPlusMap['Cmd-V']  = "goPageDown";
        //emacsyPlusMap['Cmd-B']  = "goWordLeft";
        emacsyPlusMap['Alt-F']  = "goWordRight";
        emacsyPlusMap['Shift-Alt-,']  = "goDocStart";
        emacsyPlusMap['Shift-Alt-.']  = "goDocEnd";

        emacsyPlusMap['Ctrl-D'] = "delCharAfter";
        emacsyPlusMap['Alt-D']  = "delWordAfterCmd";
        emacsyPlusMap['Ctrl-Backspace']  = "delWordBeforeCmd";        

        emacsyPlusMap['Ctrl-T'] = "transposeChars";
        emacsyPlusMap['Ctrl-Space']  = "setMarkCmd";

        emacsyPlusMap['Ctrl-G']  = "cancelCmd";

        emacsyPlusMap['Ctrl-Left']    = "selPrevCharCmd";
        emacsyPlusMap['Ctrl-Right']   = "selNxtCharCmd";        
        emacsyPlusMap['Shift-Ctrl-Left']   = "selPrevWordCmd";
        emacsyPlusMap['Shift-Ctrl-Right']  = "selNxtWordCmd";
        
        
        /*--------------- Cnt-X Keymap ------------*/

        // Now the cnt-X 'secondary' keymap:
        ctrlXMap['x'] = "saveToRegCmd";
        ctrlXMap['g'] = "insertFromRegCmd";
        ctrlXMap['u'] = "undo";
        ctrlXMap['Ctrl-X'] = "xchangePtMarkCmd"; // NOTE: Cnt-x Cnt-X (2nd must be caps)

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
        // Get next key from user, which will be the key
        // into the cnt-x keymap. Complication: Cnt-X Cnt-X
        // (exchange mark/point) would re-enter this method
        // rather than become available to getNextChar().
        // temporarily disable cnt-X in the keymap:
        
        km.suspendKeyBinding('Ctrl-X');
        km.getNextChar(cm).then(function(cntXKey) {
            /*
              Once the promise is fulfilled, it will deliver the
              cnt-x command to run. E.g. the 'g' in 'Cnt-x g'.
              If the cntrlXMap has an entry for 'g', the value
              will be a function that will take one arg: the 
              CodeMirror editor object cm. But first: restore
              the ctrl-x cmd:
            */

            km.restoreKeyBinding('Ctrl-X')
            
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

    var setMarkCmd = function(cm) {
        mark = cm.doc.getCursor();
    }

    var getMark = function(cm) {
        return mark;
    }

    var xchangePtMarkCmd = function(cm) {
        var oldMark  = getMark(cm);
        var currCur  = cm.doc.getCursor();
        var newMark  = {line : currCur.line, ch : currCur.ch}
        // Marker gets current cursor pos:
        setMarkCmd(cm);
        cm.doc.setCursor(oldMark)
        cm.doc.setSelection(oldMark, newMark);
    }

    var delWordAfterCmd = function(cm) {
        var cur = cm.doc.getCursor();
        selNxtWordCmd(cm);
        var word = cm.doc.getSelection();
        CodeMirror.emacsArea.killedTxt = word;
        cm.doc.setCursor(cur);
        cm.execCommand('delWordAfter');
    }

    var delWordBeforeCmd = function(cm) {
        var cur = cm.doc.getCursor();
        selPrevWordCmd(cm);
        var word = cm.doc.getSelection();
        CodeMirror.emacsArea.killedTxt = word;
        cm.doc.setCursor(cur);
        cm.execCommand('delWordBefore');
    }

    var selNxtCharCmd = function(cm) {
        var wasExtending = cm.doc.getExtending(); 
        if (! wasExtending) {
            cm.doc.setExtending(true);
        }
        cm.execCommand('goCharRight');
        cm.doc.setExtending(wasExtending);
    }

    var selPrevCharCmd = function(cm) {
        var wasExtending = cm.doc.getExtending(); 
        if (! wasExtending) {
            cm.doc.setExtending(true);
        }
        cm.execCommand('goCharLeft');
        cm.doc.setExtending(wasExtending);
    }

    var selNxtWordCmd = function(cm) {
        cm.doc.setExtending(true);        
        cm.execCommand('goWordRight');
    }

    var selPrevWordCmd = function(cm) {
        cm.doc.setExtending(true);
        cm.execCommand('goWordLeft');
    }

    var cancelCmd = function(cm) {
        if (cm.doc.getExtending()) {
            // If currently extending selection,
            // clear that condition. If user wants
            // to (also) clear the selection, a
            // second cnt-g will do that in the
            // else branch:
            cm.doc.setExtending(false);
        } else {
            // Setting cursor to a point is
            // the equivalent of clearing selection:
            cm.doc.setCursor(cm.doc.getCursor());
        }
    }
    
    var undoCmd = function(cm) {
        undo(cm);
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

    var killRegionCmd = function(cm) {
        if (! cm.doc.somethingSelected()) {
            // Nothing selected: delete between mark and cursor:
            cm.doc.setSelection(getMark(cm), cm.doc.getCursor());
        }
        CodeMirror.emacsArea.killedTxt = cm.doc.getSelection();
        cm.doc.replaceSelection("");
        return;
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
