##CodeMirror Keymap Management, and Enhanced Emacs Mode

### *SafeKeyMap*
Two classes that build on top of the CodeMirror version used in Jupyter 4.1.0. The first class, *SafeKeyMap*, allows installation of custom keymaps, (possibly) based on keymaps that already exist in CodeMirror.

The second class, *EmacsyPlus* uses *SaveKeyMap* to implement a keymap that is closer to Emacs than CodeMirror's built-in *emacsy* map.

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
        myMap['Cmd-W']  = "copyCmd";
        myMap['Ctrl-Y'] = "yankCmd";
        myMap['Ctrl-A'] = "goLineStart";

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