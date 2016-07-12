from __future__ import print_function
import shutil
import os, sys

if (len(sys.argv) != 2) or (sys.argv[1] != 'install'):
  print("This %s is special; only the 'install' command is recognized." % sys.argv[0], file=sys.stderr)
  sys.exit()

# Is Jupyter installed?
try:
  from jupyter_core.paths import jupyter_config_dir
except ImportError:
  print("Cannot find a Jupyter installation; aborting.", file=sys.stderr)
  sys.exit()

jupyter_dir = jupyter_config_dir()
extension_dir = os.path.join(jupyter_dir, 'custom')
custom_js_path = os.path.join(extension_dir, 'custom.js')

# requireJS string that needs to go into custom.js
# to load the JS files when a notebook is started:

load_str = '''define(['base/js/namespace', 'base/js/events', 'custom/safeKeyMap', 'custom/emacsyPlus'], function(IPython, events) {
     events.on('app_initialized.NotebookApp', function() {
         new EmacsyPlus();         
     });
 });
'''

# Since the jupyter directory does exist, take liberty
# to create the subdir 'custom':

if not os.path.exists(extension_dir):
  print('Creating directory %s' % extension_dir)
  os.makedirs(extension_dir)

# Add the JS load directive to the custom.js file,
# if that directive does not already exist there:

try:  
  with open(custom_js_path, 'r') as fd:
    customizations = fd.read();
  
  if customizations.find(load_str) == -1:
    print('Adding JavaScript load directive to %s' % custom_js_path)
    with open(custom_js_path, 'r') as fd:    
      fd.write(load_str)
except IOError as e:
  print("Cannot add JavaScript load directive to Jupyter's custom.js file. Aborting. (%s)" % `e`, file=sys.stderr)
  sys.exit()

print('Copying emacsyPlus.js to %s' % extension_dir)
shutil.copy('src/emacsyPlus.js', extension_dir)
print('Copying safeKeyMap.js to %s' % extension_dir)
shutil.copy('src/safeKeyMap.js', extension_dir)

print('Installation successful')


