/* TODO:
- Maybe: cursor movements after set mark: make selection; but shut
  that off automatically 
- Connect c-x c-s with my Jupyter snapshot
*/

/*
  Implements Emacs keybindings for CodeMirror editors.
  To customize, modify buildEmacsyPlus.emacsyPlusMap
  and buildEmacsyPlus.ctrlXMap.

Warning: both Firefox and Chrome have Alt/Cmd-w bound to
'Close tab.' You'll want to disable those bindings if you 
want to use the normal Emacs yank command (which is in
effect with this mode, but shadowed by the browser.)
For Chrome on Mac: Use System Preferences-->Keyboard-->AppShortcuts
to bind Cmd-W to something else, like F2. 

In Firefox on Linux I used the MenuWizard extension.


For reference, a few keyboard key names and codes:
Linux:
    ALT   : Alt:18
    Ctrl  : Control:17
    Shift : Shift:16
  Capslock: CapsLock:20
    Home  : Home:36
    End   : End:35
 PageUp   : PageUp:33
PageDown  : PageDown:34
  Windows : = OS:91    (Microsoft keyboard)
 
MacBook (laptop keyboard Chrome):
    CMD   : Meta:91
    Option: Alt:18
    Ctrl  : Control:17
    Shift : Shift:16
  Capslock: Alt:18
    Home  : <not part of keyboard>
    End   : <not part of keyboard>
 PageUp   : <not part of keyboard>
PageDown  : <not part of keyboard>
    FN    : <not firing keydown event>
   FN-<<  : F7/118
   FN->>  : F9/120

MacBook (laptop keyboard Firefox):
    CMD   : Meta:224
    Option: Alt:18
    Ctrl  : Control:17
    Shift : Shift:16
  Capslock: Alt:18
    Home  : <not part of keyboard>
    End   : <not part of keyboard>
 PageUp   : <not part of keyboard>
PageDown  : <not part of keyboard>
    FN    : <not firing keydown event>
   FN-<<  : F7/118
   FN->>  : F9/120

MacBook through Synergy using Microsoft keyboard (server on Linux) (Firefox):
    ALT   : Meta:91
    Ctrl  : Control:17
    Shift : Shift:16
  Capslock: <not firing keydown event>
    Home  : Home:36
    End   : End:35
 PageUp   : PageUp:33
PageDown  : PageDown:34
  Windows : = Alt/18    (Microsoft keyboard)

*/

function EmacsyPlus() {

    /* Singleton class */

    var km = new SafeKeyMap();
    var emacsyPlusMap = {};
    var ctrlXMap = {};
    var mark = null;
    var os = km.getOsPlatform();

    var constructor = function() {
    
        if (typeof(EmacsyPlus.instance) !== 'undefined') {
            return EmacsyPlus.instance;
        }

        if (typeof(CodeMirror.emacsArea) === 'undefined') {
            CodeMirror.emacsArea = {
                killedTxt : "",
                multiKillInProgress : false,
                registers : {},
                bookmarks : {}
            }
        }        

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
        km.registerCommand('pointToRegisterCmd', pointToRegisterCmd, true)
        km.registerCommand('jumpToRegisterCmd', jumpToRegisterCmd, true)
        km.registerCommand('goCellStartCmd', goCellStartCmd, true)
        km.registerCommand('goCellEndCmd', goCellEndCmd, true)
        km.registerCommand('goNotebookStartCmd', goNotebookStartCmd, true)
        km.registerCommand('goNotebookEndCmd', goNotebookEndCmd, true)
        km.registerCommand('helpCmd', helpCmd, true)        

        //************
        // For testing binding suspension:

        //km.registerCommand('suspendTestCmd', suspendTestCmd, true)
        //km.registerCommand('restoreTestCmd', restoreTestCmd, true)
        //km.registerCommand('alertMeCmd', alertMeCmd, true)                
        //************        

        var mapName = null;
        if (os === 'Mac' || os === 'Linux') {
            mapName = km.installKeyMap(buildEmacsyPlus(), 'emacsy_plus', 'macDefault');
        } else {
            mapName = km.installKeyMap(buildEmacsyPlus(), 'emacsy_plus', 'pcDefault');
        }
        km.activateKeyMap(mapName);

        // Instances have only public methods:
        EmacsyPlus.instance =
            {help : helpCmd
            }

        //********
        //alert('Activated ' + mapName);
        //********        
        return EmacsyPlus.instance;
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

        
        /* Help */

        emacsyPlusMap['F1'] = "helpCmd";

        /* Killing and Yanking */

        emacsyPlusMap['Ctrl-X'] = "ctrlXCmd";  // cnt-x <?> --> processed further via ctrlXMap

        emacsyPlusMap['Ctrl-K'] = "killCmd";
        emacsyPlusMap['Ctrl-W'] = "killRegionCmd";
        emacsyPlusMap['Alt-W']  = "copyCmd";
        if (os === 'Mac') {emacsyPlusMap['Cmd-W']  = "copyCmd"};
        emacsyPlusMap['Ctrl-D'] = "delCharAfter";
        emacsyPlusMap['Alt-D']  = "delWordAfterCmd";
        if (os === 'Mac') {emacsyPlusMap['Cmd-D']  = "delWordAfterCmd"};
        emacsyPlusMap['Ctrl-Backspace']  = "delWordBeforeCmd";        

        emacsyPlusMap['Ctrl-Y'] = "yankCmd";

        /* Cursor motion */

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
        //emacsyPlusMap['Cmd-V']  = "goPageDown"; // Preserve for true sys clipboard access
        //emacsyPlusMap['Cmd-B']  = "goWordLeft"; // Preserve for true sys clipboard access
        emacsyPlusMap['Alt-F']  = "goWordRight";
        if (os === 'Mac') {emacsyPlusMap['Cmd-F']  = "goWordRight";};

        emacsyPlusMap['Shift-Ctrl-,'] = 'goCellStartCmd';  // Ctrl-<
        emacsyPlusMap['Shift-Ctrl-.'] = 'goCellEndCmd';    // Ctrl->
        emacsyPlusMap['Home']         = 'goCellStartCmd';
        emacsyPlusMap['End']          = 'goCellEndCmd';

        if (os === 'Mac') {
            emacsyPlusMap['Cmd-Up']       = 'goNotebookStartCmd';
            emacsyPlusMap['Cmd-Down']     = 'goNotebookEndCmd';
        } else {
            emacsyPlusMap['Alt-Up']       = 'goNotebookStartCmd';
            emacsyPlusMap['Alt-Down']     = 'goNotebookEndCmd';
        }
        

        emacsyPlusMap['Ctrl-T'] = "transposeChars";
        emacsyPlusMap['Ctrl-Space']  = "setMarkCmd";

        emacsyPlusMap['Ctrl-G']  = "cancelCmd";

        /* Selections */
        emacsyPlusMap['Ctrl-Left']    = "selPrevCharCmd";
        emacsyPlusMap['Ctrl-Right']   = "selNxtCharCmd";        
        emacsyPlusMap['Shift-Ctrl-Left']   = "selPrevWordCmd";
        emacsyPlusMap['Shift-Ctrl-Right']  = "selNxtWordCmd";

        //*******************
        // For testing binding suspension:
    
        //emacsyPlusMap['Shift-X']  = "alertMeCmd";        
        //emacsyPlusMap['Shift-H']  = "suspendTestCmd";
        //emacsyPlusMap['Shift-I']  = "restoreTestCmd";
        //*******************
        
        /*--------------- Cnt-X Keymap ------------*/

        // Now the cnt-X 'secondary' keymap:
        ctrlXMap['x'] = "saveToRegCmd";
        ctrlXMap['g'] = "insertFromRegCmd";
        ctrlXMap['u'] = "undo";
        ctrlXMap['/'] = "pointToRegisterCmd";
        ctrlXMap['j'] = "jumpToRegisterCmd";
        ctrlXMap['Ctrl-X'] = "xchangePtMarkCmd"; // NOTE: Cnt-x Cnt-X (2nd must be caps)

        return emacsyPlusMap;
    }

    /* ------------------ Utilities ----------------- */

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

    var getCm = function(cell) {
        /*
          Returns the CodeMirror editor instance of
          a Jupyter cell. If cell is provided then
          that cell's editor is returned. Else the
          editor of the currently selected cell is
          returned.

          :param cell: optionally the cell whose CodeMirror editor instance is to be returned.
          :type cell: {JupyterCell | undefined}
          :returns the cell's CodeMirror instance
          :rtype CodeMirror
         */
        if (typeof(cell) === 'undefined') {
            cell = Jupyter.notebook.get_selected_cell();
        }
        return cell.code_mirror;
    }

    var clearSelection = function(cm) {
        cm.doc.setSelection(cm.doc.getCursor(), cm.doc.getCursor());
    }

    var toHtml = function() {
        /*
          Calls SafeKeyMap instances toHtml() to get
          an array of Command/Keystroke pairs. Then 
          adds the ctr-x commands to the result. Returns
          the combination.
        */

        // Get raw array of 2-tuples: cmdName/keystroke:
        bindings = km.toTxt();
        // Add the ctrl-X keys:
        for (var cntXKey in ctrlXMap) {
            if (ctrlXMap.hasOwnProperty(cntXKey)) {
                bindings.push([ctrlXMap[cntXKey], `Ctrl-x ${cntXKey}`]);
            }
        }
        // I don't know where Ctrl-/ is set (to comment-region),
        // but it is...somewhere:
        bindings.push(['commentRegion', 'Ctrl-/'])
        
        // Re-sort the bindings:
        bindings.sort(
            function(cmdVal1, cmdVal2) {
                switch(cmdVal1[0] < cmdVal2[0]) {
                case true:
                    return -1;
                    break;
                case false:
                    if (cmdVal1[0] === cmdVal2[0]) {
                        return 0;
                    } else {
                        return 1;
                    }
                    break;
                }
            }
        )
        // Turn into html table:
        var tableHtml = km.toHtml(bindings);
        var htmlPage = `<html><head><style>table, th, td {
            border: 1px solid black;
            border-collapse : collapse;
            padding : 4px;
            background-color : LightBlue;
        }</style><body><h1>EmacsyPlus Bindings</h2>${tableHtml}</body></html>`;
        return htmlPage;
    }

    /*------------------------------- Commands for CodeMirror  -------------- */

    //***********
    // For testing binding suspension, which isn't working yet:
    
    var alertMeCmd = function(cm) {
        alert('Did it');
    }
    var suspendTestCmd = function(cm) {
        km.suspendKeyBinding('X');
    }
    var restoreTestCmd = function(cm) {
        km.restoreKeyBinding('X');
    }
    
    //***********    

    var helpCmd = function(cm) {
        /*
          Pops up window with key bindings.
        */
        
        var wnd = window.open('about:blank', 'Emacs Help', 'width=400,height=200,scrollbars=yes');
        wnd.document.write(toHtml());
    }

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
        
        // NOTE: the suspent/restore bindings command is not working.
        //       So Cnt-x Cnt-x will re-enter, rather then be made
        //       available to the getNextChar() below. Needs fixing
        //       in safeKeyMap.
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

        if (! cm.doc.somethingSelected()) {
            // Nothing selected: grab region between mark and cursor:
            cm.doc.setSelection(getMark(cm), cm.doc.getCursor());
        }
        
        var selectedTxt = cm.getSelection();
        // Grab the next keystroke, which is
        // the register name:
        km.getNextChar(cm).then(function (regName) {
            CodeMirror.emacsArea.registers[regName] = selectedTxt;
            clearSelection(cm);
        })
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

    var pointToRegisterCmd = function(cm) {
        var focusedCell = Jupyter.notebook.get_selected_cell();
        var bookmark = cm.doc.setBookmark(cm.doc.getCursor());
        // Grab the next keystroke, which is
        // the register name:
        km.getNextChar(cm).then(function (regName) {
            CodeMirror.emacsArea.bookmarks[regName] = {cell : focusedCell, bookmark : bookmark}
        })
    }

    var jumpToRegisterCmd = function(cm) {
        // Get bookmark-register name:
        km.getNextChar(cm).then(function (regName) {
            var cellBm = CodeMirror.emacsArea.bookmarks[regName]
            if (typeof(cellBm) === 'undefined') {
                return
            }
            var cell   = cellBm.cell;
            var bm     = cellBm.bookmark;
            // Get that cell's CodeMirror editor instance:
            newCm = getCm(cell);
            // Change focus to bookmark-cell:
            newCm.focus();
            newCm.doc.setCursor(bm.find());
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
        cm.doc.replaceSelection("");
    }

    var delWordBeforeCmd = function(cm) {
        var cur = cm.doc.getCursor();
        selPrevWordCmd(cm);
        var word = cm.doc.getSelection();
        CodeMirror.emacsArea.killedTxt = word;
        cm.doc.replaceSelection("");        
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

    var goCellStartCmd = function(cm) {
        cm.doc.setCursor({line : 0, ch : 0});
    }

    var goCellEndCmd = function(cm) {
        var lastLine = cm.getLine(cm.doc.lastLine())
        cm.doc.setCursor({line : cm.doc.lineCount(), ch : lastLine.length-1});
    }

    var goNotebookStartCmd = function(cm) {
        getCm(Jupyter.notebook.get_cells()[0]).focus();
    }

    var goNotebookEndCmd = function(cm) {
        // array.slice(-1)[0] returns last element:
        getCm(Jupyter.notebook.get_cells().slice(-1)[0]).focus();
    }
    

    /* ----------------------------  Call Constructor and Export Public Methods ---------- */

    return constructor();


} // end class EmacsyPlus
