#!/usr/bin/env bash

echo "loading tilix setting into dconf under /org/gnome/shell/extensions/"
dconf load  /org/gnome/shell/extensions/ < gnome_shell_extension_dconf