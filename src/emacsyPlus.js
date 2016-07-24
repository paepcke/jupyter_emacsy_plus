/* TODO:
- In iSearch: scroll to make hit visible
- In iSearch: maybe make selection pop more
- Reverse search
- Cnt-L to center
- Doc: Emacs keys only work in edit mode.
- Doc: Move some to ReadTheDocs
- Connect c-x c-s with my Jupyter snapshot setup.
*/

/*
  Implements Emacs keybindings for CodeMirror editors.
  To customize, modify buildEmacsyPlus.emacsyPlusMap
  and buildEmacsyPlus.ctrlXMap below.

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

/* -------------------------  Class EmacsyPlus --------------- */

function EmacsyPlus() {

    /* Singleton class */

    var BS_CODE    = 8;   // backspace
    var ENTER_CODE = 13;
    var CTRL_CODE  = 17;
    var ESC_CODE   = 27;

    var BACK_SEARCH = true;
    var FORW_SEARCH = false;
    var CASE_SENSITIVE = true;
    var CASE_INSENSITIVE = false;

    var km = new SafeKeyMap();
    var emacsyPlusMap = {};
    var ctrlXMap = {};
    var mark = null;
    var os = km.getOsPlatform();
    var ctrlInProgress = false;

    var mBufName   = 'minibuffer';
    var minibufMonitored = false;
    var iSearcher  = null;
    var savedPlace = undefined;
    // For remembering what user searched for
    // in preceeding iSearch. Used to support
    // cnt-s in an empty minibuf:
    var prevSearchTerm = null;

    // Keydown and mouse click listeners while in minibuf:
    var mBufKeyListener = null;
    var mBufClickListener = null;

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

        // Hack: I couldn't figure out how to add a
        // css sheet whose class names were found by
        //   CodeMirror.doc.setMarker(start,end,{className : <className>}).
        // So the following (internally) looks for the already laoded codemirror.css
        // sheet and adds a highlighting rule to it:
        addSearchHighlightRule();

        km.registerCommand('ctrlXCmd', ctrlXCmd, true);  // true: ok to overwrite function
        km.registerCommand('killCmd', killCmd, true);
        km.registerCommand('killRegionCmd', killRegionCmd, true);
        km.registerCommand('yankCmd', yankCmd, true);
        km.registerCommand('copyCmd', copyCmd, true);
        km.registerCommand('setMarkCmd', setMarkCmd, true);
        km.registerCommand('selPrevCharCmd', selPrevCharCmd, true);
        km.registerCommand('selNxtCharCmd', selNxtCharCmd, true);             
        km.registerCommand('selNxtWordCmd', selNxtWordCmd, true);
        km.registerCommand('selPrevWordCmd', selPrevWordCmd, true);
        km.registerCommand('delWordAfterCmd', delWordAfterCmd, true);
        km.registerCommand('delWordBeforeCmd', delWordBeforeCmd, true);
        km.registerCommand('saveToRegCmd', saveToRegCmd, true);
        km.registerCommand('insertFromRegCmd', insertFromRegCmd, true);
        km.registerCommand('cancelCmd', cancelCmd, true);
        km.registerCommand('xchangePtMarkCmd', xchangePtMarkCmd, true);
        km.registerCommand('pointToRegisterCmd', pointToRegisterCmd, true);
        km.registerCommand('jumpToRegisterCmd', jumpToRegisterCmd, true);
        km.registerCommand('goCellStartCmd', goCellStartCmd, true);
        km.registerCommand('goCellEndCmd', goCellEndCmd, true);
        km.registerCommand('goNotebookStartCmd', goNotebookStartCmd, true);
        km.registerCommand('goNotebookEndCmd', goNotebookEndCmd, true);
        km.registerCommand('openLineCmd', openLineCmd, true);
        km.registerCommand('isearchForwardCmd', isearchForwardCmd, true);
        km.registerCommand('isearchBackwardCmd', isearchBackwardCmd, true);
        km.registerCommand('reSearchForwardCmd', reSearchForwardCmd, true);
        km.registerCommand('goNxtCellCmd', goNxtCellCmd, true);
        km.registerCommand('goPrvCellCmd', goPrvCellCmd, true);
        km.registerCommand('helpCmd', helpCmd, true);
        

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

        // A couple of commands in CodeMirror's default Mac keymap
        // conflict with standard OSX-level commands. Take those out
        // of the basemap so they don't even show up in the keybindings
        // help window:

        if (os === 'Mac') {
            // On Macs these two show windows on the desktop in reduced size,
            // and vice versa:
            km.deleteParentKeyBinding('Ctrl-Up');    // bound to goDocEnd
            km.deleteParentKeyBinding('Ctrl-Down');  // bound to goDocStart

            km.deleteParentKeyBinding('Ctrl-Alt-Backspace') // does nothing
            km.deleteParentKeyBinding('Home')
            km.deleteParentKeyBinding('End');
        }
        
        // Instances of this EmacsyPlus class have only public methods:
        EmacsyPlus.instance =
            {help : helpCmd,
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
        emacsyPlusMap['Ctrl-H'] = "delCharBefore";
        emacsyPlusMap['Ctrl-D'] = "delCharAfter";
        emacsyPlusMap['Alt-D']  = "delWordAfterCmd";
        if (os === 'Mac') {emacsyPlusMap['Cmd-D']  = "delWordAfterCmd"};
        emacsyPlusMap['Ctrl-Backspace']  = "delWordBeforeCmd";        

        emacsyPlusMap['Ctrl-Y'] = "yankCmd";
        emacsyPlusMap['Ctrl-O'] = "openLineCmd";

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

        emacsyPlusMap['Shift-Ctrl-,']      = 'goCellStartCmd';  // Ctrl-<
        emacsyPlusMap['Shift-Ctrl-.']      = 'goCellEndCmd';    // Ctrl->
        emacsyPlusMap['Home']              = 'goCellStartCmd';
        emacsyPlusMap['End']               = 'goCellEndCmd';

        emacsyPlusMap['Shift-Ctrl-N']      = 'goNxtCellCmd';
        emacsyPlusMap['Shift-Ctrl-P']      = 'goPrvCellCmd';        

        if (os === 'Mac') {
            emacsyPlusMap['Cmd-Up']        = 'goNotebookStartCmd';
            emacsyPlusMap['Cmd-Down']      = 'goNotebookEndCmd';
        } else {
            emacsyPlusMap['Alt-Up']        = 'goNotebookStartCmd';
            emacsyPlusMap['Alt-Down']      = 'goNotebookEndCmd';
        }
        

        emacsyPlusMap['Ctrl-T']            = "transposeChars";
        emacsyPlusMap['Ctrl-Space']        = "setMarkCmd";

        emacsyPlusMap['Ctrl-G']            = "cancelCmd";

        /* Selections */
        emacsyPlusMap['Ctrl-Left']         = "selPrevCharCmd";
        emacsyPlusMap['Ctrl-Right']        = "selNxtCharCmd";        
        emacsyPlusMap['Shift-Ctrl-Left']   = "selPrevWordCmd";
        emacsyPlusMap['Shift-Ctrl-Right']  = "selNxtWordCmd";

        /* Searching */
        emacsyPlusMap['Ctrl-S']            = "isearchForwardCmd";
        emacsyPlusMap['Ctrl-R']            = "isearchBackwardCmd";
        emacsyPlusMap['Shift-Ctrl-S']      = "reSearchForwardCmd";

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
        ctrlXMap['h'] = "helpCmd";
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
        // Copy cursor so as not to disrupt selections:
        var pos = {line : cursor.line, ch : cursor.ch}
        cm.doc.replaceRange(txt, pos);
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

    var addSearchHighlightRule = function() {
        /*
        // Hack: I couldn't figure out how to add a
        // css sheet whose class names were found by
        //
        //   CodeMirror.doc.setMarker(start,end,{className : <className>}).
        //
        // So the following (internally) looks for the already laoded codemirror.css
        // sheet and adds a highlighting rule to it.
        // Terrible hack.

        */
        var cssSheets = document.styleSheets;
        var cmSheet = null;
        for (let sheet of cssSheets) {
            if (sheet.href.search(/codemirror.css/) > -1) {
                cmSheet = sheet;
                break;
            }
        }
        if (cmSheet === null) {
            return false;
        } else {
            // Yellow:
            cmSheet.insertRule(".emacsyPlusSearchHighlight { background-color : #F9F221; }", 1)
        }
        return true;
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
        
        var wnd = window.open('about:blank', 'Emacs Help', 'width=400,height=500,scrollbars=yes');
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
            cm.doc.setExtending(false);
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

    var openLineCmd = function(cm) {
        var cursor = cm.doc.getCursor();
        var newCursor = {line : cursor.line, ch : cursor.ch}
        insertTxt(cm, '\n');
        cm.doc.setCursor(newCursor);
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
            cm.doc.setExtending(false);
            clearSelection(cm);
        }
    }

    var setMarkCmd = function(cm) {
        mark = cm.doc.getCursor();
        clearSelection(cm);
        cm.doc.setExtending(true);
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
        abortISearch();
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
        cm.doc.setExtending(false);
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

    var goNxtCellCmd = function(cm) {
        Jupyter.notebook.select_next().edit_mode();
    }

    var goPrvCellCmd = function(cm) {
        Jupyter.notebook.select_prev().edit_mode();
    }

    var goNotebookStartCmd = function(cm) {
        getCm(Jupyter.notebook.get_cells()[0]).focus();
    }

    var goNotebookEndCmd = function(cm) {
        // array.slice(-1)[0] returns last element:
        getCm(Jupyter.notebook.get_cells().slice(-1)[0]).focus();
    }

    var isearchForwardCmd = function(cm) {
        isearchCmd(cm, false); // reverse === false
    }
    
    var isearchBackwardCmd = function(cm) {
        isearchCmd(cm, true); // reverse === true
    }

    var isearchCmd = function(cm, reverse) {
        prepSearch(cm);
        // This ISearcher instance will be search from
        // the current position. The keydown interrupt
        // service routing iSearchHandler will add or
        // remove letters.
        iSearcher  = ISearcher('', false, reverse); // false: not regex search
        // Ensure the persistent search term from last
        // search is cleared out:
        iSearcher.emptySearchTerm();
        // Ensure that search starts at cursor:
        primeSearchStart(cm, iSearcher);        
        // Present the minibuffer, get focus to it,
        // and behave isearchy via the iSearchHandler:
        var mBuf = monitorMiniBuf(iSearchHandler)
    }

    var reSearchForwardCmd = function(cm) {
        prepSearch(cm);
        // This ISearcher instance will be search from
        // the current position. The keydown interrupt
        // service routing iSearchHandler will add or
        // remove letters.
        iSearcher  = ISearcher('', true, false); // true: be regex search,
                                                 // false: not reverse
        // Ensure the persistent search term from last
        // search is cleared out:
        iSearcher.emptySearchTerm();
        // Ensure that search starts at cursor:
        primeSearchStart(cm, iSearcher);
        // Present the minibuffer, get focus to it,
        // and behave isearchy via the iSearchHandler:
        var mBuf = monitorMiniBuf(iSearchHandler)
    }

    var prepSearch = function(cm) {
        var cur = cm.doc.getCursor();
        savedPlace = {cm : cm, line : cur.line, ch : cur.ch};      
    }

    var primeSearchStart = function(cm, iSearcher) {
        /*
          Makes the very first char be found where
          the cursor is, rather than at start of
          current input cell:
         */

        if (iSearcher.curPlace().inCellArea() === 'input') {
            // Ensure that the search starts at
            // current cursor:
            var curCur = cm.doc.getCursor();
            iSearcher.setInitialSearchStart(curCur);
        }
    }

    /* ----------- Incremental Search -------------*/

    var iSearchHandler =  function(evt) {
        // Called with hidden first arg: 'this',
        // which is the minibuffer.

        // If abortISearch() was called, and 
        // a keydown was already in the queue,
        // we'll know it here, b/c abortISearch()
        // will have set iSearcher to null.

        if (iSearcher === null) {
            return;
        }

        // If doing a regex search, 'normal',
        // i.e. non-error minibuf background
        // is green:
        var normalColor = 'white';
        if (iSearcher.regexSearch()) {
            normalColor = 'DarkTurquoise';
        }

        // Filter out unwanted keystrokes in minibuf:
        if (! iSearchAllowable(evt)) {
            evt.preventDefault();
            evt.stopPropagation();
            return;
        }

        // cnt-g or esc?
        if (evt.abort) {
            // Save the current search term in case
            // we want to reuse it:
            prevSearchTerm = iSearcher.searchTerm();
            var restoreCursor = true;
            if (evt.abort === 'esc') {
                restoreCursor = false;
                // For regex we only collected the regex
                // in the minibuf so far. Execute the
                // search before quiting the minibuf:
                iSearcher.next();
            }
            abortISearch(restoreCursor);
            evt.preventDefault();
            evt.stopPropagation();
            return;
        }

        var mBuf = this
        var bufVal = mBuf.value;
        iSearcher.setCaseSensitivity(false);

        // If minibuffer empty, take opportunity
        // to ensure that isearcher's current search
        // term is also empty:
        // iSearcher.emptySearchTerm();
        
        // Another ctrl-s or ctrl-r while in minibuf:
        if (evt.search === 'nxtForward' ||
            evt.search === 'nxtBackward') {

            evt.search === 'nxtForward' ?
                iSearcher.setReverse(false) : iSearcher.setReverse(true);
            
            // If minibuffer is empty, fill in
            // the previous search term and
            // run the search as if it had been
            // entered by hand:
            if (bufVal.length === 0 && prevSearchTerm !== null) {
                
                // If prev search term had any caps, set case
                // sensitivity:
                if (prevSearchTerm.search(/[A-Z]/) > -1) {
                    iSearcher.setCaseSensitivity(true);
                }
                var matchedSubstr = iSearcher.playSearch(prevSearchTerm);
                if (matchedSubstr.length < prevSearchTerm.length) {
                    mBuf.style.backgroundColor = 'red';
                }
                mBuf.value = matchedSubstr;
                bufVal = mBuf.value;
            } else {
                // Cnt-s/Cnt-r after a term was found:
                var res = iSearcher.searchAgain();
                if (res === null) {
                    mBuf.style.backgroundColor = 'red';                
                } else {
                    mBuf.style.backgroundColor = normalColor;
                }
            }
            evt.preventDefault();
            evt.stopPropagation();
            return;
        }

        mBuf.style.backgroundColor = normalColor;            
        mBuf.focus();

        // Case sensitivity is determined
        // by any of the search term chars
        // being upper case. Check whether
        // the new key, appended to the current
        // content of the minibuffer fills that
        // condition. BUT: control chars are returned
        // as words, e.g. 'Backspace', which would
        // turn the search case sensistive. So: only
        // check with single-length new keystrokes:
        var newKey = evt.key;
        if (newKey.length > 1) {
            newKey = '';
        }
        if ((bufVal+newKey).search(/[A-Z]/) > -1) {
            iSearcher.setCaseSensitivity(true);
        }

        // Add the new char to the minibuffer and the
        // iSearcher instance, unless it was cnt-s or cnt-r
        // (search again/search backward):

        var searchRes = null;

        if (evt.search === undefined) {
            if (evt.which === BS_CODE) {
                mBuf.value = bufVal.slice(0,-1);
                searchRes = iSearcher.chopChar();
            } else {
                mBuf.value = bufVal + evt.key;
                searchRes = iSearcher.addChar(evt.key);
            }
        }

        //*******
        // if (evt.search == 'nxtBackward') {
        //     searchRes = self.find(txt, caseSensitivity, BACK_SEARCH);
        // } else {
        //     searchRes = self.find(txt, caseSensitivity, FORW_SEARCH);
        // }

        if (searchRes !== null || iSearcher.searchTerm().length === 0) {
            mBuf.style.backgroundColor = normalColor;
        } else {
            mBuf.style.backgroundColor = 'red';
        }

        evt.preventDefault();
        evt.stopPropagation();
    }

    var abortISearch = function(restoreCursor) {
        // If abortISearch is called twice,
        // iSearcher will be null. In that case,
        // just return. This way it's safe to
        // call abortISearch multiple times:
        if (iSearcher === null) {
            return;
        }
        
        removeMiniBuf();
        iSearcher.clearHighlights();

        if (typeof(restoreCursor) === 'undefined') {
            restoreCursor = true;
        }

        if (restoreCursor && typeof(savedPlace) === 'object') {
            savedPlace.cm.doc.setCursor({line: savedPlace.line, ch: savedPlace.ch});
        } else {
            var cells    = Jupyter.notebook.get_cells();
            var lastPlace = iSearcher.curPlace();
            var curCell  = cells[lastPlace.cellIndx()];
            curCell.code_mirror.doc.setCursor(lastPlace.selection().head);
            curCell.focus_cell();
        }
        
        Jupyter.notebook.edit_mode();
        iSearcher = null;
    }

    var addMiniBuf = function() {
        // Get input area of cell:
        var toolbarDiv = getToolbarDomEl();
        var miniBuf = document.createElement('input');
        miniBuf.type = 'text';
        toolbarDiv[mBufName] = miniBuf;
        toolbarDiv.appendChild(miniBuf);
        miniBuf.style.paddingLeft = '5px';
        miniBuf.style.marginLeft = '5px';
        return miniBuf;
    }

    var removeMiniBuf = function() {
        var miniBuf = getToolbarDomEl()[mBufName];
        if (typeof(miniBuf) === 'undefined') {
            return '';
        }
        stopMonitorMiniBuf(iSearchHandler);
        var miniBufContent = miniBuf.value;
        miniBuf.value = "";
        var parentEl = miniBuf.parentElement;
        if (parentEl != null && typeof(parentEl) != 'undefined') {
            parentEl.removeChild(miniBuf);
            parentEl[mBufName] = undefined;
        }
        return miniBufContent;
    }

    var monitorMiniBuf = function(callback) {

        // Protect against being called multiple
        // times:
        if (minibufMonitored) {
            return;
        }
        
        var miniBuf = getMiniBufFromToolbar();
        miniBuf.focus();
        clearAllSelections();
        // Need event listener to be named function,
        // b/c we'll have to remove it when isearch
        // is over:
        mBufKeyListener = function(evt) {
            // Have this call, rather than making
            // callback the listener directly so that
            // we can provide the miniBuf environment:
            callback.call(miniBuf, evt);
        }
        mBufClickListener = function(evt) {
            // If clicked on minibuffer, do nothing.
            // If clicked outside, abort search:
            if (evt.target === miniBuf) {
                miniBuf.focus();
                return;
            }
            
            abortISearch(false); // don't restore cursor, leave it at selection.
            document.removeEventListener("mousedown", mBufClickListener);
        }
        getToolbarDomEl().addEventListener("keydown", mBufKeyListener);
        document.addEventListener("mousedown", mBufClickListener);
        minibufMonitored = true;
        return miniBuf;
    }

    var stopMonitorMiniBuf = function(callback) {
        getToolbarDomEl().removeEventListener("keydown", mBufKeyListener);
        document.removeEventListener("mousedown", mBufClickListener);
        minibufMonitored = false;
    }

    var getMiniBufFromToolbar = function() {
        var toolbarDiv = getToolbarDomEl();
        var miniBuf = getToolbarDomEl()[mBufName]
        if (typeof(miniBuf) === 'undefined') {
            miniBuf = addMiniBuf();
        }
        return miniBuf;
    }

    var getToolbarDomEl = function() {
        return Jupyter.toolbar.element[0];
    }

    var ensureCell = function(cell) {
        if (typeof(cell) === 'undefined') {
            cell = Jupyter.notebook.get_selected_cell();
        }
        return cell;
    }
    

    /* --------------  Utilities ---------------- */

    var iSearchAllowable = function(evt) {

        /*
          Accepts: esc, cnt-g, cnt-s, cnt-r
          For esc and cnt-g: sets evt.abort=true, else 'false'
         */

        var keyCode = evt.which;

        evt.abort = false;
        evt.search = undefined;

        // Special care about two ctrl-s in a row
        // at start of isearch: first ctrl-s is
        // seen by Jupyter cell, not this routine.
        // That first ctrl-s opens the minibuffer,
        // and from then on this routine catches
        // keydown events. So ctrl-keys and letter
        // keys are processed sequentially. We see
        // the ctrl going down, then the other letter.
        // When we see the ctrl key go down, we
        // set ctrlInProgress true so we enter the
        // following switch. But if a ctrl-something
        // comes in as first chr after minibuffer opens,
        // we only see the char. BUT: then the evt.ctrlKey
        // will be set:
        if (ctrlInProgress || evt.ctrlKey) {
            // Ctrl-key held down, then key pressed:
            switch(evt.key) {
            case 'g':
                ctrlInProgress = false;
                evt.abort = 'Ctrl-G';
                return true;
                break;
            case 's':
                ctrlInProgress = false;                
                evt.search = 'nxtForward';
                return true;
                break;
            case 'r':
                evt.search = 'nxtBackward';
                return true;
                break;
            default:
                ctrlInProgress = false; // unknown ctrl-key
                return false; // have caller do nothing
                break;
            }
        }

        // In iSearch mode: exit search,
        // leave cursor at found spot.
        // For regex search: execute the
        // search:
        if (keyCode === ENTER_CODE) {
            ctrlInProgress = false;
            evt.abort = 'esc';
            return true;
        }

        // Exit search, leave cursor where
        // search found spot:
        if (keyCode === ESC_CODE) {
            ctrlInProgress = false;
            evt.abort = 'esc';
            return true;
        }

        // Just register that the next
        // key will be a ctrl-<something> key
        if (keyCode === CTRL_CODE) {
            ctrlInProgress = true;
            return false;
        }

        var valid =
            (keyCode === BS_CODE)                     ||
            (keyCode > 47  && keyCode < 58)   || // number keys
            (keyCode == 32)                   || // spacebar to tilde
            (keyCode >= 48 && keyCode < 91)   || // letter/number keys
            (keyCode > 95  && keyCode < 112)  || // numpad keys
            (keyCode == 173)                  || // underscore
            (keyCode > 185 && keyCode < 193)  || // ;=,-./`
            (keyCode > 218 && keyCode < 223);    // [\]' (in order) 173: _

        return valid;
    }

    /*----------------------
      | clearAllSelections
      | ----------------- */

    var clearAllSelections = function() {
        for (let cell of Jupyter.notebook.get_cells()) {
            clearSelection(cell.code_mirror);
        }
    }
    
    /*----------------------
      | findLastSelection
      | ----------------- */

    var findLastSelection = function() {
        /*
          Returns the last selection within the last cell
          of a notebook. If no selection exists, returns
          undefined. 

          :returns Object with properties 'cell', and 'selection'.
             The cell property holds the cell that contains the
             last selection. The selection object is of the form
             {anchor : {line: <n> : ch: <n>}, head : {line: <m> : ch: <m>}}
          :rtype {object | undefined}
         */
        var cells = Jupyter.notebook.get_cells();
        for (let i=cells.length-1; i>=0; i--) {
            var cell = cells[i];
            var selections = cell.code_mirror.doc.listSelections();
            if (selections.length > 0) {
                // Found last cell with at least one
                // selection:
                var lastSelection = selections[selections.length - 1];
                // Every cell has one 'empty' selection. It's
                // anchor and head are the same:
                if (selectionEmpty(lastSelection)) {
                    continue;
                }
                return {cell : cell, selection: lastSelection};
            }
        }
        return undefined;
    }
    

    var selectionEmpty = function(sel) {
        return (sel.anchor.ch > 0);
        // return (sel.anchor.line === sel.head.line &&
        //         sel.anchor.ch === sel.head.ch);
    }


    /* ----------------------------  Call Constructor and Export Public Methods ---------- */

    return constructor();


} // end class EmacsyPlus

    /* ----------------------------  Class Place  ---------- */

Place = function(initObj) {

    var thisPlace = null;

    var constructor = function(initObj) {
        thisPlace = createPlace();
        
        if (typeof(initObj) !== 'undefined') {

            // Very defensively copy given values
            // to our standard Place instance:
            
            for (let placeInfo of Object.keys(initObj)) {
                if (initObj.hasOwnProperty(placeInfo)) {
                    let value = initObj[placeInfo];
                    switch(placeInfo) {
                    case 'cellIndx':
                        thisPlace.cellIndx = value(); // value is a getter method
                        break;
                    case 'inCellArea':
                        thisPlace.inCellArea = value();
                        break;
                    case 'firstSrchInArea':
                        thisPlace.firstSrchInArea = value();
                        break;
                    case 'isISearchStart':
                        thisPlace.isISearchStart = value();
                        break;
                    case 'searchStart':
                        thisPlace.searchStart = value();
                        break;
                    case 'selection':
                        // Check for passed-in values ill-formed:
                        try {
                            thisPlace.selection.anchor.line = value().anchor.line;
                        } catch(err) {throw "Place selection property without anchor.line"};
                        try {
                            thisPlace.selection.anchor.ch = value().anchor.ch;
                        } catch(err) {throw "Place selection property without anchor.ch"};
                        try {
                            thisPlace.selection.head.line = value().head.line;
                        } catch(err) {throw "Place selection property without head.line"};
                        try {
                            thisPlace.selection.head.ch = value().head.ch;
                        } catch(err) {throw "Place selection property without head.ch"};
                    }
                }
            }
        }
        
        return {
            value : value, // method
            cellIndx : cellIndx, // getter
            setCellIndx : setCellIndx, // setter            
            inCellArea : inCellArea, // getter
            setInCellArea : setInCellArea, // setter
            isISearchStart : isISearchStart, // getter
            setIsISearchStart : setIsISearchStart, // setter
            firstSrchInArea : firstSrchInArea, // getter
            isISearchStart : isISearchStart, // getter            
            setFirstSrchInArea : setFirstSrchInArea, // setter
            searchStart : searchStart, // getter
            setSearchStart : setSearchStart, // setter            
            selection : selection, // getter
            setSelection : setSelection, // setter 
            clone : clone, // method
            nullTheSelection : nullTheSelection // method
        }
    }

    var value = function() {
        return thisPlace;
    }

    var cellIndx = function() {
        return thisPlace.cellIndx;
    }

    var setCellIndx = function(newIndx) {
        thisPlace.cellIndx = newIndx
        return newIndx;
    }

    var inCellArea = function() {
        return thisPlace.inCellArea;
    }

    var setInCellArea = function(newArea) {
        thisPlace.inCellArea = newArea;
        return newArea;
    }

    var firstSrchInArea = function() {
        return thisPlace.firstSrchInArea;
    }

    var setFirstSrchInArea = function(isFirst) {
        thisPlace.firstSrchInArea = isFirst;
        return isFirst;
    }

    var isISearchStart = function() {
        return thisPlace.isISearchStart;
    }

    var setIsISearchStart = function(isFirst) {
        thisPlace.isISearchStart = isFirst;
        return isFirst;
    }

    var searchStart = function() {
        return thisPlace.searchStart
    }

    var setSearchStart = function(newSearchStart) {
        thisPlace.searchStart = newSearchStart;
        return newSearchStart;
    }

    var selection = function() {
        return thisPlace.selection;
    }
    
    var setSelection = function(newSelection) {
        thisPlace.selection = newSelection;
        return newSelection;
    }


    var clone = function() {
        return Place(this);
    }

    var createPlace = function() {
        /*
          Creates a default place that records the cell and
          cursor position upon creation of this ISearcher instance.
         */

        var initialCell  = Jupyter.notebook.get_selected_cell();
        initialCursor = initialCell.code_mirror.doc.getCursor();
        
        return {cellIndx : Jupyter.notebook.find_cell_index(initialCell), 
                inCellArea : 'input',
                isISearchStart : true,
                firstSrchInArea : true,
                searchStart : undefined,
                selection : {anchor : {line : initialCursor.line, ch : initialCursor.ch},
                             head   : {line : initialCursor.line, ch : initialCursor.ch}
                            }
               }
    }

    var copy = function(other) {
        /*
          Returns the copy of a place.
        */
        thisPlace.cellIndx    = other.cellIndx();
        thisPlace.inCellArea    = other.inCellArea();
        thisPlace.firstSrchInArea = other.firstSrchInArea();
        thisPlace.isISearchStart = other.isISearchStart();
        thisPlace.searchStart = other.searchStart();
        copySel(other.selection().anchor, thisPlace.selection().anchor);
        copySel(other.selection().head, thisPlace.selection().head);
        return dst;
    }

    var copySel = function(src, dst) {
        dst.line = src.line;
        dst.ch   = src.ch;
    }

    var nullTheSelection = function() {
        thisPlace.selection.anchor.line = 0;
        thisPlace.selection.anchor.ch = 0;
        thisPlace.selection.head.line = 0;
        thisPlace.selection.head.ch = 0;
    }

    return constructor(initObj);
}

    /* ----------------------------  Class ISearcher  ---------- */

ISearcher = function(initialSearchTxt, isReSearch, searchReverse) {

    /* Handles incremental and regex searches across entire
       notebook. Scrolls to hits.

       Implementation note: all functions and instance vars are
          private. Vars preceeded by underscores are available outside
          via setters/getters. See return value of constructor.
    */

    // All the areas within a cell to search through:
    var searchAreas = ['input', 'output'];

    // Install a 'class variable' that holds the
    // search term across instances:
    if (typeof(ISearcher.prototype.searchTerm) === 'undefined') {
        ISearcher.prototype.searchTerm = '';
    }

    var reSafeTxt = '';
    var reSearch = false;
    var _reverse  = searchReverse;

    var _caseSensitivity = false;
    var cells = Jupyter.notebook.get_cells();

    // For saving positions in notebook where
    // a previous match occurred during iSearch.
    // I.e. matches of fewer letters in the
    // minibuffer than entered up to a given point:
    var placeStack  = [];

    var highlightMarkers = [];

    // Remember where in notebook we started search
    var _initialPlace = Place();

    // Progressively changing place in notebook; inits
    // to initial cell/cursor
    var _curPlace = Place();

    var constructor = function(initialSearchTxt, isReSearch, searchReverse) {
        if (isReSearch) {
            // Regex search:
            reSearch = true;
        }
        if (searchReverse) {
            _reverse = true;
        } else {
            _reverse = false;
        }
        // The following if is not tested, b/c
        // never used so far:
        if (typeof(initialSearchTxt) === 'string') {
            setSearchTerm(initialSearchTxt);
            if (reSearch) {
                reSafeTxt = searchTerm();
            } else {
                reSafeTxt = escReSpecials(searchTerm());
            }
        }

        return Object.preventExtensions({
            next : next, // method
            searchAgain : searchAgain, // method
            addChar : addChar, // method
            chopChar : chopChar, // method
            searchTerm : searchTerm, // getter
            setInitialSearchStart : setInitialSearchStart, // setter
            emptySearchTerm : emptySearchTerm, // method
            caseSensitivity : caseSensitivity, // getter
            setCaseSensitivity : setCaseSensitivity, // setter
            curPlace : curPlace, // getter
            setCurPlace : setCurPlace, //setter
            initialPlace : initialPlace, // getter
            regexSearch : regexSearch, // getter
            reverse : reverse, // getter
            setReverse : setReverse, // setter
            clearHighlights : clearHighlights, // method
            playSearch : playSearch
        })
    }
    var searchTerm = function() {
        return ISearcher.prototype.searchTerm;
    }

    var setSearchTerm = function(newTerm) {
        ISearcher.prototype.searchTerm = newTerm;
    }

    var emptySearchTerm = function() {
        setSearchTerm('');
    }

    var initialPlace = function() {
        return _initialPlace;
    }

    var setInitialSearchStart = function(curPos) {
        /*
          Given a cursor position, ensure that 
          next search action starts at that position.

          :param curPos: CodeMirror-style position: {line: int, ch: int}
          :type curPos: object
         */

        // Get where we are (recall: pop of empty stack returns
        // start of notebook):
        var curCell = Jupyter.notebook.get_selected_cell();
        var txtCurCell = curCell.get_text();
        var cm = curCell.code_mirror;
        var curCur = cm.doc.getCursor();
        popPlace();
        curPlace().setSearchStart(absChCount(txtCurCell, curCur));
        // Hack! Push two copies, so that when the
        // very first char is typed in the minibuf,
        // the addChar() method's call to goPrevMatch()
        // will leave this initial search frame on the
        // stack:
        pushPlace(curPlace());
        pushPlace(curPlace());        
    }

    var setCurPlace = function(newPlace) {
        _curPlace = newPlace;
        return _curPlace;
    }

    var curPlace = function() {
        return _curPlace;
    }

    var setCaseSensitivity = function(isCaseSens) {
        _caseSensitivity = isCaseSens;
        return _caseSensitivity;
    }

    var caseSensitivity = function() {
        return _caseSensitivity;
    }

    var regexSearch = function() {
        return reSearch;
    }

    var reverse = function() {
        return _reverse;
    }

    var setReverse = function(searchReverse) {
        _reverse = searchReverse;
    }


    var playSearch = function(term, fromEmpty) {
        /*
          Run a series of incremental searches
          that mimic successive user input of
          characters. If fromEmpty is left out,
          the existing searchTerm is first wiped
          out.

          :param term: search term to play
          :type term: string
          :param fromEmpty: if true, or left out: first clear 
             existing search term. Else append to existing.
          :returns (possibly) partial string up to 
             which a match was achieved.
          :rtype: string

        */
        var initialSearchTerm;
        if (typeof(fromEmpty) === 'undefined' || fromEmpty) {
            setSearchTerm('');
            initialSearchTerm = '';
        } else {
            initialSearchTerm = searchTerm();
        }
        for (let i=0; i<term.length; i++) {
            if (addChar(term[i]) === null) {
                return initialSearchTerm + term.slice(i);
            }
        }
        return initialSearchTerm + term;
    }

    var clearSelection = function(cm) {
        /*
          NOTE: clears selection within a CodeMirror node.
                For clearing selections in the HTML page,
                see clearDivSelection().
         */
        cm.doc.setSelection(cm.doc.getCursor(), cm.doc.getCursor());
    }

    var clearAllSelections = function() {
        /*
          NOTE: clears selection within a CodeMirror node.
                For clearing selections in the HTML page,
                see clearDivSelection().
         */
        for (let cell of cells) {
            clearSelection(cell.code_mirror);
        }
    }

    var absChCount = function(txt, position) {
        var chCount = 0;
        if (position.line <= 0) {
            return Math.min(position.ch, txt.length-1);
        }
        for (let line=0; line<=position.line; line++) {
            let lineChCount = txt.slice(chCount).search('\n');
            if (lineChCount === -1) {
                return Math.min(chCount + position.ch, txt.length-1);
            }
            // The +1: the \n of this line:
            chCount += lineChCount + 1;
            if (chCount > txt.length-1) {
                return txt.length;
            }
        }
    }

    var lineChIndx = function(str, offset) {
        /* Given a multiline string and an offset integer into
           the string, return the zero-origin line number of the
           offset-containing line, and the remainder char count.
           I.e. return a position {line: <l>, ch : <c>}.
        */
        var lines    = str.split('\n');
        var lineIndx = 0;
        // Number of CRs in whole string minus the
        // number of CRs after the match:
        var crsAllStr = str.match(/\n/g)
        if (crsAllStr !== null) {
            // Do have some CRs. 
            var numAllCrs = crsAllStr.length;
            // Any CRs after the offset?
            var crsAfter = str.slice(offset).match(/\n/g);
            if (crsAfter !== null) {
                // Also have CRs after offset:
                var numCrsAfter = crsAfter.length;
                lineIndx = numAllCrs - numCrsAfter;
            } else {
                // Match is in last line, after at least
                // earlier one CR:
                lineIndx = numAllCrs;
                
            }
        } // No CRs at all, leave lineIndx at 0
        
        var prevChrs = 0;
        for (let i=0; i<lineIndx; i++) {
            prevChrs += lines[i].length;
        }
        // Subtract lineIndx b/c offset won't include newlines:
        var inLineOffset = offset - prevChrs - lineIndx;
        return {line : lineIndx, ch : inLineOffset};
    }

    var pushPlace = function(place) {
        /*
          Make copy of a place, and push it onto place stack.
        */
        var placeClone = place.clone();
        placeStack.push(placeClone);
        setCurPlace(placeClone);
    }

    var popPlace = function() {
        /*
          Pops most recent place off the stack and returns it.
          If stack empty, returns a start of notebook for a place.
        */
        if (placeStack.length === 0) {
            return Place();
        }
        setCurPlace(placeStack.pop());
        return curPlace();
    }

    var escReSpecials = function(searchStr) {
        // ^$.()*+[]\
        var safeStr = searchStr.replace(/\^/g, '\\^');
        safeStr = safeStr.replace(/\$/g, '\\$');
        safeStr = safeStr.replace(/\./g, '\\.');
        safeStr = safeStr.replace(/\(/g, '\\(');
        safeStr = safeStr.replace(/\)/g, '\\)');
        safeStr = safeStr.replace(/\*/g, '\\*');
        safeStr = safeStr.replace(/\+/g, '\\+');
        safeStr = safeStr.replace(/\[/g, '\\[');
        safeStr = safeStr.replace(/\]/g, '\\]');
        safeStr = safeStr.replace(/\\/g, '\\\\');

        return RegExp(safeStr);
    }


    var goPrevMatch = function(howFar) {
        /* 
           Have the next call to next() go back
           to a previous selection, one that was
           valid for a shorter search string than
           the most recent.

           :param howFar: if provided, number of
           previous selections to go back to.
           Default: 1
           :type howFar: integer
        */

        // Note that stack will be empty if next() was
        // never called or no match was ever found. Or
        // the *currently* selected place in the notebook
        // will be at top of stack.
        if (typeof(howFar) === 'undefined') {
            howFar = 1;
        } else if (howFar > placeStack.length) {
            howFar = placeStack.length;
        } else if (howFar < 1) {
            throw `Prev-match rollback must be a positive int. Was ${howFar}`;
        }
        // Pop all but the last of the number of
        // requested place frame pops:
        for (let i=0; i<howFar-1; i++) {
            popPlace();
        }
        // Last pop is the one caller wants:
        popPlace();
        return curPlace();
    }
    
    var next = function(repeatSearch) {
        /* Finds next result. Returns a place object if
           successful, else returns null. If repeatSearch
           is true, skips past the current search
           result to find the next result for the same
           search str. 

           Instance variable '_reverse' being true indicates backward
           search. It proceeds backward within the current cell area,
           then entering the previous cell area, then entering the
           last area of the previous cell, etc.

           :param repeatSearch: if true, skip past current search
              result, and find next occurrence. Default: false.
           :type repeatSearch: bool
        */
        
        if (typeof(repeatSearch) === 'undefined') {
            repeatSearch = false;
        }

        // Get where we are (recall: pop of empty stack returns
        // start of notebook):
        popPlace();
        // Save current selection place back onto
        // the place stack.
        pushPlace(curPlace());

        // Each loop-around looks at all areas of one cell.
        // The loop statement is funky to accommodate looping
        // either forward or backward, depending on whether
        // '_reverse' is true or not:
        for (let i=curPlace().cellIndx(); 
             function() {
                 return _reverse ? i>=0 : i<cells.length;
             }();
             function() {
                 return _reverse ? i-- : i++;
             }()) {

            curPlace().setCellIndx(i);
            var cell = cells[i];
            var cm  = cell.code_mirror;
            var curSearchArea = curPlace().inCellArea();
            // Will hold cell area text:
            var txt = null;

            // Go through each area, starting with the one
            // the previous search left off in. The weird
            // termination test fakes a 'finally' clause.
            // when areaIndx reaches the number of areas in
            // a cell, the second OR expression is executed.
            // That function MUST return false; else infinite
            // loop:

            var initialAreaIndx = searchAreas.findIndex(function(workArea)
                                                        {return workArea === curSearchArea}
                                                       );
            // Same fancy footwork as in outer loop.
            // Plus: the OR clause functions as a
            // 'finally' facility. The prepForNextCell() 
            // is guaranteed to return false:
            for (let areaIndx=initialAreaIndx;
                 function() {
                     return _reverse ? areaIndx>=0 : areaIndx<searchAreas.length;
                 }() || prepForNextCell(curPlace);
                 function() {
                     return _reverse ? areaIndx-- : areaIndx++;
                 }()) {


                // 'input', 'output', ...
                var area2Search = searchAreas[areaIndx];
                curPlace().setInCellArea(area2Search);

                // Grab text out of the cell, from the area
                // that are currently searching:
                try {
                    txt = getTextFromCell(cell, area2Search);
                    // If this is the first search in this
                    // area, init the search start cursor.
                    // NOTE: when a new cell is entered in
                    // the outer loop, then this inner loop
                    // will inititialize to the area in which
                    // a previous search had a hit. So the
                    // area may in fact have seen a search before,
                    // even though we are in this loop.

                    // If this is the very start of an iSearch,
                    // then the start of the search will have
                    // been initialized already: to the current
                    // cursor position. In that case, leave
                    // searchStart alone:
                    if (curPlace().firstSrchInArea() &&
                        ! curPlace().isISearchStart()) {
                        
                        // For reverse search we need to set
                        // the search cursor to the end of this
                        // new area's text, for forward, start at
                        // loc zero:
                        if (_reverse) {
                            curPlace().setSearchStart(txt.length-1);
                        } else {
                            curPlace().setSearchStart(0);
                        }
                    }
                } catch(err) {
                    // Next cell area to look into:
                    continue;
                }

                // No longer in very first search:
                curPlace().setIsISearchStart(false);
                
                var re  = null;
                // Note: we use String.search(re)
                // for searching whether or not the
                // UI presents regex or incremental
                // search. The difference is in how
                // the search string is escaped.
                if (caseSensitivity()) {
                    re = new RegExp(reSafeTxt);
                } else {
                    re = new RegExp(reSafeTxt, 'i'); // ignore case
                }

                var txtToSearch = null;
                if (typeof(curPlace().searchStart()) === 'undefined') {
                    if (_reverse) {
                        curPlace().setSearchStart(txt.length - 1)
                    } else {
                        curPlace().setSearchStart(0)
                    }
                }

                // Looking for next occurrence of already
                // found search term?: if so, and we found one,
                // point the search cursor past that one
                // we found so we don't re-find it. Note:
                // for reverse-search we need not worry, b/c the
                // search cursor will already be in front of the
                // search term:
                if (repeatSearch &&
                    startsWith(txt.slice(curPlace().searchStart()),
                               searchTerm(),
                               caseSensitivity())
                   ) {
                    if (_reverse) {
                        // Set search start such that call to regexLastExec()
                        // below will be called with startpos===<start of current match>.
                        // That will cause regexLastExec() to disregard the
                        // match and beyond, searching instead for a previous
                        // occurrence of the same match:
                        curPlace().setSearchStart(curPlace().searchStart() -
                                                  searchTerm().length);

                    } else {
                        // For foward search we set the search cursor
                        // beyond the found part of the str so it won't
                        // be found again, unless this is the first search
                        // in this cell area:
                        if (curPlace().firstSrchInArea()) {
                            curPlace().setSearchStart(0);
                            curPlace().setFirstSrchInArea(false);
                        } else {
                            curPlace().setSearchStart(curPlace().searchStart() +
                                                      searchTerm().length);

                        }
                    }
                }
           
                var res;
                if (_reverse) {
                    res = regexLastExec(txt, re, curPlace().searchStart() + searchTerm().length);
                } else {
                    // Search only from the current match position onwards:
                    let sliceToSearch = txt.slice(curPlace().searchStart());
                    txtToSearch = sliceToSearch;
                    res = re.exec(txtToSearch);
                    if (res !== null) {
                        // Correct the index of the match start to
                        // be relative to the start of the area:
                        res.index += txt.length - sliceToSearch.length;
                    }
                }

                if (res === null) {
                    curPlace().setFirstSrchInArea(true);
                    clearSelection(cm);
                    continue; // next (input/output) area or cell
                }

                // Got a match:

                if (area2Search === 'output') {
                    // Ensure user sees the output area--unfold it:
                    cell.expand_output();
                }

                curPlace().setFirstSrchInArea(false);                

                // Get match index in terms of cell line/ch, given
                // the match index within the full cell content:
                var startOfMatch = res.index
                var selStart = lineChIndx(txt, startOfMatch);

                // In the all-in-one cell string we are now
                // at where search started this time (searchStart),
                // plus result of the search, plus length of
                // search word, which we will select below:
                curPlace().setSearchStart(startOfMatch);

                curPlace().selection().anchor.line = selStart.line;
                curPlace().selection().anchor.ch = selStart.ch;

                curPlace().selection().head.line = selStart.line;
                // Res is array of occurrences. So length of matched
                // text is available from that even for regex search
                // the the search term has the regex special chars:
                curPlace().selection().head.ch = selStart.ch + res[0].length;
                // Save this newest (i.e. current) position:
                pushPlace(curPlace());
                
                // Selection techniques are different for input vs. output
                // area. Could maybe be unified. Input areas use CodeMirror
                // selections. Output areas use browser selections:
                if (area2Search === 'input') {
                    clearSelection(cm);
                    clearHighlights();
                    cm.doc.setSelection(curPlace().selection().anchor,
                                        curPlace().selection().head);
                    setHighlight(cell,
                                 curPlace().selection().anchor,
                                 curPlace().selection().head);
                } else {
                    clearDivSelection();
                    setDivSelectionRange(cell.output_area.selector[0],
                                         startOfMatch,
                                         startOfMatch + res[0].length
                                        );
                }
                Jupyter.notebook.scroll_manager.scroll_to(cell.element);
                return curPlace();
            }
        }
        return null;
    }

    var getTextFromCell = function(cell, area) {
        /*
          Given a cell and an area name, return
          text from that cell's area.

          :param cell: a Jupyter cell instance
          :type cell: Cell
          :param area: One of 'input', 'output'.
          :type area: string
        */
        if (searchAreas.indexOf(area) === -1) {
            throw `Unknown area '${area}'`;
        }

        if (area === 'input') {
            return cell.get_text();
        }
        // Output area:

        try {
            var output = cell.output_area.outputs[0];
        } catch(err) {
            // Cell does not have an output area:
            throw `Cell type '${cell.cell_type}' has no output area.`
        }
        var outType = output.output_type;
        if (outType === 'display_data') {
            return output.data['text/plain']
        } else if (outType === 'stream') {
            return output.text
        } else {
            throw `Area output '${outType}' unknown`;
        }
    }

    var prepForNextCell = function(curPlace) {
        /*
          Called when all areas of a cell have
          been searched, and the search advances
          to a new cell. This function MUST
          return false, else the for loop in which
          it is used goes infinite.
         */
        curPlace().nullTheSelection();
        if (_reverse) {
            curPlace().setSearchStart(searchTerm().length-1);
        } else {
            curPlace().setSearchStart(0);
        }
        // Moving on to a new cell; reset current
        // cell area to the first in the sequence
        // of cell areas, or the last, depending
        // on search direction:
        if (_reverse) {
            curPlace().setInCellArea(searchAreas[searchAreas.length-1]);
        } else {
            curPlace().setInCellArea(searchAreas[0]);
        }



        return false;
    }

    var searchOutputArea = function(re, cell) {
        var outAreaTxt = cell.output_area.outputs[0].text;
        cell.collapsed
    }


    var searchAgain = function() {
        return next(true); // true: skip one result
    }
    
    var addChar = function(chr) {
        var curTerm = searchTerm();
        curTerm += chr;
        setSearchTerm(curTerm);
        if (_reverse) {
            //****On first char-entry in search: searchStart === 0, not 1!
            curPlace().setSearchStart(curPlace().searchStart() + 1);
        }
        if (! reSearch) {
            // Update the isearch-needed regex escapes
            reSafeTxt = escReSpecials(searchTerm())
        } else {
            reSafeTxt = searchTerm();
            // For regex search: don't search incrementally:
            return true;
        }
        goPrevMatch();
        // Process new content of minibuf:
        return next();
    }
        
    var chopChar = function() {
        setSearchTerm(searchTerm().slice(0, searchTerm().length-1));
        if (! reSearch) {
            // Update the isearch-needed regex escapes
            reSafeTxt = escReSpecials(searchTerm())
        } else {
            reSafeTxt = searchTerm();
            // For regex search: don't search incrementally:
            return true;
        }
        goPrevMatch();
        if (searchTerm().length === 0){
            clearSelection(cells[curPlace().cellIndx()].code_mirror);
            // Return to initial position:
            pushPlace(_initialPlace);
        }
        return next();
    }

    var setDivSelectionRange = function(cellDiv, start, end) {
        /* Given a div that includes at least one text node, and a range, 
           select the first text. 
           
           Jupyter: for the main (input) cell area: cell.input[0]
                    for output area: cell.output_area.selector[0]

           :param cellDiv: HTML div element in which selection is
              to be made.
           :type cellDiv: object
           :param start: start location relative to start of div.
           :type start: int
           :param end: end location relative to start of div.
           :type end: int
        */

        var txtNodes = getTextNodesIn(cellDiv);
        if (txtNodes.length === 0) {
            throw 'Given div does not contain any text nodes.'
        }
        var txtNode = txtNodes[0];
        if (start < 0 || start > end) {
            throw `Selection end must be positive and less than end: -1<=0<${end}, was ${start}`;
        }
        if (end > txtNode.length) {
            throw `Selection end must not exceed text length, but ${end} > ${txtNode.length}`;
        }
        var selection = window.getSelection();
        var range = document.createRange();
        range.selectNodeContents(cellDiv);
        range.setStart(txtNode, start)
        range.setEnd(txtNode, end)
        selection.removeAllRanges()
        selection.addRange(range)
    }

    var clearDivSelection = function() {
        window.getSelection().removeAllRanges();
    }

    var setHighlight = function(cell, anchor, head) {
        var cm = cell.code_mirror;
        highlightMarkers.push(cm.doc.markText(anchor,
                                              head,
                                              {className : 'emacsyPlusSearchHighlight'}));
    }
    
    var clearHighlights = function() {
        for (let marker of highlightMarkers) {
            marker.clear();
        }
        highlightMarkers = [];
    }

    var getTextNodesIn = function(node) {
        /*
          Given a div element, return all text nodes inside it.
          From http://stackoverflow.com/questions/6240139/highlight-text-range-using-javascript
        */
        var textNodes = [];
        if (node.nodeType == 3) {
            textNodes.push(node);
        } else {
            var children = node.childNodes;
            for (var i = 0, len = children.length; i < len; ++i) {
                textNodes.push.apply(textNodes, getTextNodesIn(children[i]));
            }
        }
        return textNodes;
    }

    var startsWith = function(str, searchStr, caseSensitive) {
        /* Equivalent to JavaScript built-in startswith(), 
           but with option caseSensitive added.
        */
        var regex = new RegExp(searchStr,
                               (caseSensitive ? "" : "i") 
                              );
        return regex.exec(str) !== null;
    }

    var regexLastExec = function(str, re, startpos) {
        /*
          Behaves like regex.exec(), but searches for
          the last successful re.exec() in the given string.
          Startpos can be used to remove the *tail* of str.
          By default, startpos is one more than the length of 
          str, so the entire string will be back-searched.
          Example: 

             - re  = /fo/i
             - str = 'Dog eats dog'
             - startpos = 0

          The index attribute of the returned value will be 9.
          But if startpos were, say 4, then the index attribute
          would be 0. 

          NOTE: if you pass in 0 for startpos, nothing will be searched.

          Return value is the same as the re.exec() call. That is,
          an array whose first element is the full string of matched 
          characters. Following elements, if any, are collected groups.
          The return's 'index' property holds the index at which the 
          match occurred in str. For other properties of the return, see
          RegExp.exec(). If no match was found, returns null.

          The passed-in regexp's lastIndex property will be updated.
             
         */
        
        // Build local copy of re. Since we update the passed-in
        // re's lastIndex anyway, we don't really have to do this:
        re = (re.global) ? re : new RegExp(re.source,
                                           "g" +
                                           (re.ignoreCase ? "i" : "") +
                                           (re.multiLine ? "m" : ""));
        if(typeof (startpos) == "undefined") {
            startpos = str.length;
        } else if(startpos < 0) {
            startpos = 0;
        }
        var stringToWorkWith = str.substring(0, startpos + 1);
        var lastIndexOf = -1;
        var prevResult = null;
        var result;
        while((result = re.exec(stringToWorkWith)) != null) {
            lastIndexOf  = result.index;
            re.lastIndex = lastIndexOf + 1;
            prevResult   = copyRegexRes(result);
        }
        // Update the passed-in re's lastIndex property:
        if (prevResult != null) {
            re.lastIndex = prevResult.index;
        }
        
        // The most recent search returned null, which
        // is how we exited the loop above. Return the
        // previous result
        return prevResult;
    }

    var copyRegexRes = function(reRes) {
        newReRes = [];
        for (let reResEl of reRes) {
            newReRes.push(reResEl);
        }
        newReRes.index = reRes.index;
        newReRes.input = reRes.input;
        return newReRes;
    }
    
    return constructor(initialSearchTxt, isReSearch, searchReverse);
}
