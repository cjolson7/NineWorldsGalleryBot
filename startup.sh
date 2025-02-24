# not a real shell script just a bunch of startup commands
# filetype lets this borrow vscode's syntax highlighting 

# current startup command
if [[ -d .git ]]; then git pull; fi; git status; if [[ ! -z ${NODE_PACKAGES} ]]; then npm install ${NODE_PACKAGES}; fi; if [ -f /home/container/package.json ]; then  npm install --production; fi; node /home/container/bot.js

# check for differences
if [[ -d .git ]]; then git pull; fi; git diff

# clear local changes
if [[ -d .git ]]; then git status; fi; git reset --hard HEAD