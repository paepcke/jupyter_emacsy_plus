##Enhanced Emacs Mode for CodeMirror and Jupyter

Two classes that build on top of the CodeMirror version used in Jupyter 4.1.0. The first class, *SafeKeyMap*, allows installation of custom keymaps, (possibly) based on keymaps that already exist in CodeMirror.

The second class, *EmacsyPlus* uses *SaveKeyMap* to implement an editing mode closer to Emacs than CodeMirror's built-in *emacsy* map.
###*EmacsyPlus*

*EmacsyPlus* creates a keymap closer to Emacs than the 'emacsy' map provided with CodeMirror. For instance the following are provided:

- Named content registers
- Named location registers
- Single- and multi-line kills (cnt-k), which can then be yanked (cnt-y). 
- Cnt-x [?]> commands are supported via a secondary keymap dispatch.
- Key binding changes accomplished by changing a table, similar to what would happen in a .emacs file.


### *SafeKeyMap*
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


###*EmacsyPlus*

The second class, *EmacsyPlus*. Creates a keymap closer to Emacs than the 'emacsy' map provided with CodeMirror. For instance: registers are implemented, as is single- and multi-line kills (cnt-k), which can then be yanked (cnt-y). Cnt-x [?]> sequences are supported via a  secondary keymap dispatch. Extensibility just requires additions to `keystroke->command` tables.

###*Installation*

- Clone the repo.
- If used for Jupyter: 
```
python setup.py install
```
The use of setuptools maybe an abuse, since the code is purely JavaScript. But it's convenient.
- While the code is all CodeMirror, it does assume the existence of a global variable CodeMirror. This variable is available in Jupyter 4.0.x notebooks, which is where the code was tested. The automatic installation assumes that Jupyter is installed. For other contexts a more manual installation is needed: The classes need to be loaded, and the CodeMirror variable must be created.

###*Known Bugs or Limitations*
- Some browsers' keyboard shortcuts are processed before CodeMirror receives keystrokes. Two common Emacs keys conflict with this pre-emption: Alt/Meta/Cmd-D, and Alt/Meta/Cmd-W. The former sets a bookmark for the currently visited page. The latter deletes the current browser tab. In Firefox you can install the MenuWizard add-on and disable/change those, or other interfering keys.
- In `suspendKeyBinding()` and `restoreKeyBinding()` methods in *SafeKeyMap* don't work. The bindings seem to get properly removed from the correct map, as well as restored. But the commands bound to the keys are still called. Maybe CodeMirror needs to be kicked to refresh some cash?
- Because of the above bug, `Cnt-x Cnt-x` (exchange point/mark) can't be implemented as planned. The workaround in the current code is to bind the command to `Cnt-x Cnt-X` instead. Note the capitalization in the second keystroke. Once the first bug is fixed, this second one goes away.