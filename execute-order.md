## Some machine will have to create user

sudo useradd -U -m -G sudo leogray && sudo passwd leogray

## Generic setup process

Setup_User.yaml --ask-become-pass

Install_basic_packages.yaml

## Setup command line dev env

Setup_zsh.yaml

Install_dev_packages.yaml

## Setup ubuntu desktop 

Desktop-play/UB-desktop-install.yaml

## Setup desktop dev enviroment

Desktop-play/Install-desktop-dev-tools.yaml

## Setup desktop in my flavior

Desktop-play/Install-gnome-extensions.yaml
