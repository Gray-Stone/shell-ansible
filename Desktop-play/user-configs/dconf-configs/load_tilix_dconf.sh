#!/usr/bin/env bash

echo "loading tilix setting into dconf under /com/gexperts/Tilix/"
dconf load /com/gexperts/Tilix/ < tilix_dconf