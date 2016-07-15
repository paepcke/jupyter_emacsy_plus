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

/* -------------------------  Class EmacsyPlus --------------- */

function EmacsyPlus() {

    /* Singleton class */

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
    var iSearcher  = null;
    var savedPlace = undefined;

    var mBufKeyListener = null;

    var bsCode    = 8;   // backspace
    var enterCode = 13;
    var ctrlCode  = 17;
    var escCode   = 27;

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
        km.registerCommand('openLineCmd', openLineCmd, true)
        km.registerCommand('isearchForwardCmd', isearchForwardCmd, true)        
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
        emacsyPlusMap['Ctrl-R']            = "findPrev";

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
    
    var isearchForwardCmd = function(cm) {
        //window.find();
        var cur = cm.doc.getCursor();
        savedPlace = {cm : cm, line : cur.line, ch : cur.ch};
        // This ISearcher instance will be search from
        // the current position. The keydown interrupt
        // service routing iSearchHandler will add or
        // remove letters.
        iSearcher  = ISearcher();

        // Present the minibuffer, get focus to it,
        // and behave isearchy via the iSearchHandler:
        var mBuf = monitorMiniBuf(iSearchHandler)
    }

    /* ----------- Incremental Search -------------*/

    var iSearchHandler =  function(evt) {

        if (! iSearchAllowable(evt)) {
            evt.preventDefault();
            evt.stopPropagation();
            return;
        }

        if (evt.abort) {
            var restoreCursor = true;
            if (evt.abort === 'esc') {
                restoreCursor = false;
            }
            abortISearch(restoreCursor);
            evt.preventDefault();
            evt.stopPropagation();
            return;
        }
        
        // **** If evt.search === 'nxtForward',
        //      then call iSearcher.next();
        //      If it's 'nxtBackward', then do that.

        var mBuf = this
        var bufVal = mBuf.value;
        mBuf.focus();

        // Case sensitivity is determined
        // by any of the search term chars
        // being upper case:
        if ((bufVal+evt.key).search(/[A-Z]/) > -1) {
            iSearcher.setCaseSensitivity(true);
        }

        // Add the new char to the minibuffer and the
        // iSearcher instance, unless it was cnt-s or cnt-r
        // (search again/search backward):

        var searchRes = null;
        if (evt.search === undefined) {
            if (evt.which === bsCode) {
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
            mBuf.style.backgroundColor = 'white';
        } else {
            mBuf.style.backgroundColor = 'red';
        }

        evt.preventDefault();
        evt.stopPropagation();
    }

    var abortISearch = function(restoreCursor) {
        removeMiniBuf();

        if (typeof(restoreCursor) === 'undefined') {
            restoreCursor = true;
        }

        if (restoreCursor && typeof(savedPlace) === 'object') {
            savedPlace.cm.doc.setCursor({line: savedPlace.line, ch: savedPlace.ch});
        } else {
            var cells    = Jupyter.notebook.get_cells();
            var curPlace = iSearcher.curPlace();
            var curCell  = cells[curPlace.cellIndx];
            curCell.code_mirror.doc.setCursor(curPlace.selection.head);
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
        var miniBuf = getMiniBufFromToolbar();
        miniBuf.focus();
        clearAllSelections();
        // Need event listener to be named function,
        // b/c we'll have to remove it when isearch
        // is over:
        mBufKeyListener = function(evt) {
            // Call the callback with minibuffer object
            // bound to 'this':
            callback.call(miniBuf, evt);
        }
        getToolbarDomEl().addEventListener("keydown", mBufKeyListener);
        return miniBuf;
    }

    var stopMonitorMiniBuf = function(callback) {
        getToolbarDomEl().removeEventListener("keydown", mBufKeyListener);
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

        if (ctrlInProgress) {
            switch(evt.key) {
            case 'g':
                ctrlInProgress = false;
                evt.abort = 'Ctrl-G';
                return true;
                break;
            case 's':
                evt.search = 'nxtForward';
                return true;
                break;
            case 'r':
                evt.search = 'nxtBackward';
                return true;
                break;
            }
        }

        if (keyCode === escCode) {
            ctrlInProgress = false;
            evt.abort = 'esc';
            return true;
        }
        
        if (keyCode === ctrlCode) {
            ctrlInProgress = true;
            return false;
        } else {
            ctrlInProgress = false;
        }
        var valid =
            (keyCode === bsCode)                     ||
            (keyCode > 47  && keyCode < 58)          || // number keys
            (keyCode == 32)                          || // spacebar
            (keyCode > 64  && keyCode < 91)          || // letter keys
            (keyCode > 95  && keyCode < 112)         || // numpad keys
            (keyCode > 185 && keyCode < 193)         || // ;=,-./` (in order)
            (keyCode > 218 && keyCode < 223);           // [\]' (in order)

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

    var cellIndx;
    var inOutput;
    var searchStart;
    var selection;
    
    var constructor = function(initObj) {
        thisPlace = createPlace();
        
        if (typeof(initObj) !== 'undefined') {

            // Very defensively copy given values
            // to our standard Place instance:
            
            for (let placeInfo of initObj) {
                if (initObj.hasOwnProperty(placeInfo)) {
                    let value = initObj[placeInfo];
                    switch(value) {
                    case 'cellIndx':
                        thisPlace.cellIndx = value;
                        break;
                    case 'inOutput':
                        thisPlace.inOutput = value;
                        break;
                    case 'searchStart':
                        thisPlace.searchStart = value;
                        break;
                    case 'selection':
                        // Check for passed-in values ill-formed:
                        try {
                            thisPlace.selection.anchor.line = value.anchor.line;
                        } catch(err) {throw "Place selection property without anchor.line"};
                        try {
                            thisPlace.selection.anchor.ch = value.anchor.ch;
                        } catch(err) {throw "Place selection property without anchor.ch"};
                        try {
                            thisPlace.selection.head.line = value.head.line;
                        } catch(err) {throw "Place selection property without head.line"};
                        try {
                            thisPlace.selection.head.ch = value.head.ch;
                        } catch(err) {throw "Place selection property without head.ch"};
                    }
                }
            }
        }
        var cellIndx    = thisPlace.cellIndx;
        var inOutput    = thisPlace.inOutput;
        var searchStart = thisPlace.searchStart;
        var selection   = thisPlace.selection;
        
        return {
            value : value,
            cellIndx : cellIndx,
            inOutput : inOutput,
            searchStart : searchStart,
            selection : selection,
            clone : clone,
            nullTheSelection : nullTheSelection
        }
    }

    var value = function() {
        return thisPlace;
    }

    var clone = function() {
        return new Place(thisPlace);
    }

    var createPlace = function() {
        /*
          Creates a default place that records the cell and
          cursor position upon creation of this ISearcher instance.
         */

        var initialCell  = Jupyter.notebook.get_selected_cell();
        initialCursor = initialCell.code_mirror.doc.getCursor();
        
        return {cellIndx : Jupyter.notebook.find_cell_index(initialCell), 
                inOutput : false,
                searchStart : 0,
                selection : {anchor : {line : initialCursor.line, ch : initialCursor.ch},
                             head   : {line : initialCursor.line, ch : initialCursor.ch}
                            }
               }
    }

    var copy = function(other) {
        /*
          Returns the copy of a place.
        */
        thisPlace.cellIndx    = other.cellIndx;
        thisPlace.inOutput    = other.inOutput;
        thisPlace.searchStart = other.searchStart;
        copySel(other.selection.anchor, thisPlace.selection.anchor);
        copySel(other.selection.head, thisPlace.selection.head);
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

    return constructor();
}

    /* ----------------------------  Class ISearcher  ---------- */

ISearcher = function(initialSearchTxt) {

    var searchTxt = '';
    if (typeof(initialSearchTxt) === 'string') {
        searchTxt = initialSearchTxt;
    }
    var caseSensitivity = false;
    var cells = Jupyter.notebook.get_cells();

    // For saving positions in notebook where
    // a previous match occurred during iSearch.
    // I.e. matches of fewer letters in the
    // minibuffer than entered up to a given point:
    var placeStack  = [];

    var initialPlace = Place();

    // Place in notebook; inits to initial cell/cursor
    var curPlace = Place();
    
    var clearSelection = function(cm) {
        cm.doc.setSelection(cm.doc.getCursor(), cm.doc.getCursor());
    }

    var clearAllSelections = function() {
        for (let cell of cells) {
            clearSelection(cell.code_mirror);
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
        placeStack.push(place.clone());
    }

    var popPlace = function() {
        /*
          Pops most recent place off the stack and returns it.
          If stack empty, returns a start of notebook for a place.
        */
        if (placeStack.length === 0) {
            return Place();
        }
        return placeStack.pop();
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
        curPlace = popPlace();
        return curPlace;
    }
    
    return {
        next : function() {
            // Finds next result. Returns a place object if
            // successful, else returns null;
            
            // Get where we are (recall: pop of empty stack returns
            // start of notebook):
            curPlace = popPlace();
            // Save current selection place back onto
            // the place stack.
            pushPlace(curPlace);

            for (let i=curPlace.cellIndx; i<cells.length; i++) {
                curPlace.cellIndx = i;
                var cell = cells[i];
                var cm  = cell.code_mirror;
                var txt = cell.get_text();
                var re  = null;
                if (caseSensitivity) {
                    re = new RegExp(searchTxt);
                } else {
                    re = new RegExp(searchTxt, 'i'); // ignore case
                }
                // Find as many matches in this cell as we can:
                while (true) {
                    var res = txt.slice(curPlace.searchStart).search(re);
                    if (res === -1) {
                        curPlace.nullTheSelection();
                        break; // next cell
                    }

                    // Got a match:

                    // Get line and chr within cell.
                    // Remember: the search was not from start of
                    // cell, but from end of selection. Correct
                    // for this offset:
                    var selStart = lineChIndx(txt,res + curPlace.searchStart);

                    // In the all-in-one cell string we are now
                    // at where search started this time (searchStart),
                    // plus result of the search, plus length of
                    // search word, which we will select below:
                    curPlace.searchStart += res + searchTxt.length;
                    curPlace.selection.anchor.line = selStart.line;
                    curPlace.selection.anchor.ch = selStart.ch;

                    curPlace.selection.head.line = selStart.line;
                    curPlace.selection.head.ch = selStart.ch + searchTxt.length;
                    // Save this newest (i.e. current) position:
                    pushPlace(curPlace);
                    
                    clearSelection(cm);
                    cm.doc.setSelection(curPlace.selection.anchor, curPlace.selection.head);
                    Jupyter.notebook.scroll_manager.scroll_to(cell.element);
                    return curPlace;
                }
            }
            return null;
        },

        addChar : function(chr) {
            searchTxt += chr;
            goPrevMatch();
            return this.next();
        },
        
        chopChar : function() {
            searchTxt = searchTxt.slice(0, searchTxt.length-1);
            goPrevMatch();
            if (searchTxt.length === 0){
                clearSelection(cells[curPlace.cellIndx].code_mirror);
                // Return to initial position:
                pushPlace(initialPlace);
            }
            return this.next();
        },

        searchTerm : function() {
            return searchTxt;
        },

        setCaseSensitivity : function(beCaseSensitive) {
            caseSensitivity = beCaseSensitive;
            return beCaseSensitive;
        },

        caseSensitivity : function() {
            return caseSensitivity;
        },

        curPlace : function() {
            return curPlace;
        },

        initialPlace : function() {
            return initialPlace;
        }
    }
}

