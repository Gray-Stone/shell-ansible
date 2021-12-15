#!/usr/bin/env bash

# Generate with (from aisnble home dir) dconf dump /com/gexperts/Tilix/ > Desktop-play/user-configs/dconf-configs/tilix_dconf 

echo "loading tilix setting into dconf under /com/gexperts/Tilix/"
dconf load /com/gexperts/Tilix/ < tilix_dconf