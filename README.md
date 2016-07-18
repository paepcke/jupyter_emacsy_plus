##Enhanced Emacs Mode for CodeMirror and Jupyter

An Emacs mode for Jupyter that is closer to Gnu Emacs than the built-in *emacsy* mode. Built for Jupyter 4.x.

*EmacsyPlus* creates a keymap closer to Emacs than the *emacsy* map provided with CodeMirror. For instance, the following are provided:

- Named content registers
- Named location registers
- Incremental and regex search (forward only right now)
- Single- and multi-line kills (cnt-k), which can then be yanked (cnt-y). 
- Cnt-x [?]> commands are supported via a secondary keymap dispatch.
- Key binding changes accomplished by changing a table, similar to what would happen in a .emacs file.

**Note**: Key **F1** in a Jupyter cell shows active bindings.

Disclaimer: I tried to test on Linux and Mac, in both Chrome and Firefox. I may well have missed cases. Let me know.

###*Installation*

- Install Jupyter
- Clone this repo.
- Install:

```
python setup.py install
```

The installation will copy two files into your Jupyter customization directory (by default ~/.jupyter/custom). It will also add one entry to your custom.js file in the same directory.

This is all you need to know for *EmacsyPlus*. Below is information about an underlying keymapping facility on which *EmacsyPlus* is built. Only read if you want to build a different mode.

Do scan the limitations at the bottom.

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

###*Known Bugs or Limitations*
- Currently, reverse isearch and reverse regex search are not implemented.
- Some browsers' keyboard shortcuts are processed before CodeMirror receives keystrokes. Two common Emacs keys conflict with this pre-emption: Alt/Meta/Cmd-D, and Alt/Meta/Cmd-W. The former sets a bookmark for the currently visited page. The latter deletes the current browser tab. In Firefox you can install the MenuWizard add-on and disable/change those, or other interfering keys. For Chrome on Mac: Use System Preferences-->Keyboard-->AppShortcuts
to bind Cmd-W to something else, like F2. 
- The`Cnt-x Cnt-x` (exchange point/mark) is not implemented. Instead, the current code binds this command to `Cnt-x Cnt-X` instead. Note the capitalization in the second keystroke. (It's a code re-entry problem that needs fixing.)
