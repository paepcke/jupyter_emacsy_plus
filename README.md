##Enhanced Emacs Mode for CodeMirror and Jupyter

An Emacs mode for Jupyter that is closer to Gnu Emacs than the built-in *emacsy* mode. Built for Jupyter 4.x. For instance, the following are provided:

- Named content registers
- Named location registers
- Incremental and regex search, including output areas
- Single- and multi-line kills (cnt-k), which can then be yanked (cnt-y)
- Point/mark region selection
- Cell hopping via keyboard shortcuts
- Cnt-x [?]> commands are supported via a secondary keymap dispatch
- Key binding changes accomplished by changing a table, similar to what would happen in a .emacs file
- See [bugs and limitations](#bugs) for work to be done

**Note**: Key **F1** or **Ctrl-x h** in a Jupyter cell show active bindings. It's a pop-up, so watch out for popup blocker if the help window does not appear.


Current compatibility: Runs on Chrome/Firefox MAC OSX. Runs on Ubuntu if some interfering Ubuntu keyboard shortcuts are disabled.

###*Installation*

- Install Jupyter
- Clone this repo.
- Install:

```
python setup.py install
```

The installation will copy two files into your Jupyter customization directory (by default ~/.jupyter/custom). It will also add one entry to your custom.js file in the same directory. No need to restart your server. Just reload any notebook page that is already open.

###*Usage*###

Emacs bindings are active whenever the cursor is in a cell that is in edit mode. The bindings are inactive in command mode. The **F1** or **Ctrl-x h** keys pop up a keyboard bindings table. Its order is unfortunately not very useful right now. 

The bindings are mostly what you expect, except in cases of conflict with common browser settings. See [bugs and limitations](#bugs).

Here are a few bindings you may not be aware of:

|Key | Action |
|-------------|
|ctrl-shift-s | starts regex search (forward only)|
|esc          | during incremental search:<br>exit search leaving cursor after match|
|ctrl-g       | during incremental search:<br>exit search restoring cursor.       |
|ctrl-shift-, | cursor to start of cell |
|ctrl-shift-. | cursor to end of cell |
|ctrl-shift-p | cursor to previous cell |
|ctrl-shift-n | cursor to next cell |
|alt-up       | go to first cell |
|alt-down     | got to last cell |



This is all you need to know for *EmacsyPlus*. Below is information about an underlying keymapping facility on which *EmacsyPlus* is built. Only read if you want to build a different mode.

Do scan the [limitations](#bugs) at the bottom.

-----------

### *SafeKeyMap*

The mode is built atop *SafeKeyMap* that may in itself be of use for other key mapping projects. The mode operates on CodeMirror, editor that serves Jupyter cells.

CodeMirror provides facilities for creating maps between keystroke names and commands to run when such a key is pressed. Included is the ability to define *fallthrough* maps that are consulted if the active keymap does not contain a just-pressed key. However, a bit more work is required to use those features than might be ideal. This class builds on the CodeMirror facilities; EmacsyPlus is built using this class.

#####Advantage of using *SafeKeyMap* over doing the work directly:

- Convenient combination of existing maps with new ones. Simply provide a `keystroke->command` map and the name of an existing keymap. A new keymap is created based on a copy of the existing keymap. The map is added as a fallthrough to that copy. Keys provided in the map are removed from the copy. Result: a kind of one-level keymap inheritance.

- No need to know about where/how CodeMirror keymaps are stored.

- Facility for copying keymaps.

- Facilities for clients to asynchronously wait for a key to be typed. That key may be consumed or allowed to have its usual effect. See method `getNextChar()`. The Facility uses JS promises. It is useful for implementing behaviors based on multi-key bindings such as Emacs `cnt-x [?]`. Usage:
```
safeMap.getNextChar().then(function(nxtKey) {
	[do your thing using nxtKey]
});
[do more stuff runs before nxtKey is available!]
```
The `nxtKey` is a string such as: 'a', 'Ctrl-b', 'Ctrl-B', 'Alt-x', etc.

- Convenient container for commands that implement editing behavior.

#####Model for SafeKeyMap:

- Create an object {string : string} mapping keystrokes to commands.
  Example:
		var myMap = {};
        myMap['Cmd-W']  = "copyCmd";     // Must write
        myMap['Ctrl-Y'] = "yankCmd";     // Must write
        myMap['Ctrl-A'] = "goLineStart"; // Built into CodeMirror

		var km = new SafeKeyMap();
        km.registerCommand('yankCmd', yankCmd, true) // true: ok to overwrite function
        km.registerCommand('copyCmd', copyCmd, true)

		var os = km.getOsPlatform();
        var mapName = null;
        if (os === 'Mac' || os === 'Linux') {
            mapName = km.installKeyMap(myMap, 'myMap', 'macDefault');
        } else {
            mapName = km.installKeyMap(myMap, 'my_plus', 'pcDefault');
        }
        km.activateKeyMap(mapName);

  Commands can be CodeMirror built-ins from https://codemirror.net/doc/manual.html, or new commands.

- Create any new commands required for your implementation. Commands take a single argument, a CodeMirror editor instance.

- Call method `installKeyMap()`, which will tell CodeMirror about the
  existence of this new keymap. You can then either set your editor
  instance keymap option `cm.options['keyMap']` to the name of your new
  keymap or leave that option as its default and instead activate your
  keymap:

- Call method `activateKeyMap()`. That will make your new keymap the
  default, saving the current default. To restore this default, 
  call the `deactivate()` method. Multiple calls to `activateKeyMap()`
  may be made with different keymaps. The keymap being replaced
  is again saved. A stack is used for successive saves.

- The `deactivateKeyMap()` method restores a default keymap that was
  in force before the most recent `activateKeyMap()`. If `activateKeyMap()`
  was never called, the call to `deactivateKeyMap()` has no effect.
  Method `deactivateKeyMap()` may be called multiple times if multiple
  `activateKeyMap()` calls were made previously. Each call to `deactivateKeyMap()` pops one keymap off the save.stack.

  Class *EmacsyPlus* provides an example of the whole process.


- While the code is all CodeMirror, it does assume the existence of a global variable CodeMirror. This variable is available in Jupyter 4.0.x notebooks, which is where the code was tested. The automatic installation assumes that Jupyter is installed. For other contexts a more manual installation is needed: The classes need to be loaded, and the CodeMirror variable must be created.

<a name="bugs"></a>
###*Known Bugs or Limitations*
- Some browsers' keyboard shortcuts are processed before the (CodeMirror) editors within cells receive keystrokes. Two common Emacs keys conflict with this pre-emption: <p>`Alt/Meta/Cmd-D`, and<br> `Alt/Meta/Cmd-W`.<p>The former sets a bookmark for the currently visited page. The latter deletes the current browser tab. In Firefox you can install the MenuWizard add-on and disable/change those, or other interfering keys. For Chrome on Mac: Use System Preferences-->Keyboard-->AppShortcuts to bind Cmd-W to something else, like F2.<p>Similarly, Ubuntu uses Alt to activate main-menu items. To use the alt-commands one needs to disable that Ubuntu behavior. Disabling `System Settings --> Keyboard --> Short-cuts--> *Key to show the HUD*` unfortunately does not help. The Web suggests use of ccsm (CompizConfig Settings Manager). I have not investigated.<p>

- The cut buffer is internal to emacsyPlus. The browser's clipboard is unavailable to applications for security reasons. In order to preserve the ability to copy items from Jupyter cells to the browser clipboard, the usual Emacs binding Alt/Cmd-v (down one screen) is left unbound. Same for Alt/Cmd-c (capitalize word).<p>
- Exchange point/mark) is not bound to `Cnt-x Cnt-x` as it should be. Instead, the current code binds this command to `Cnt-x Cnt-X` instead. Note the capitalization in the second keystroke. (This is a code re-entry problem into the Ctrl-X handler that needs fixing.)<p>
- Regular expression search can be confusing. The search considers text inside a cell as one string. This works fine for incremental search. But when running a regex search, one is tempted to see cells has having multiple lines. Example:<p>`brown fox`<br>`yellow bird`<br>`blue scooter`<p>Starting at pos 0, the search `^[b].*` correctly finds the end of the first line as a match. But repeating this search fails to find the third line. Reason: `blue scooter` is not 'really' after a newline. Needs fixing.
