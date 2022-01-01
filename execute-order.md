## Some machine will have to create user

sudo useradd -U -m -G sudo leogray && sudo passwd leogray

## Generic setup process

```sh
ansible-playbook Setup_User.yaml --ask-become-pass &&
ansible-playbook Install_basic_packages.yaml
```

## Setup command line dev env

```
ansible-playbook Setup_zsh.yaml &&
ansible-playbook Install_dev_packages.yaml
```

## Setup ubuntu desktop 

ansible-playbook Desktop-play/UB-desktop-install.yaml

## Setup desktop dev enviroment

ansible-playbook Desktop-play/Install-desktop-dev-tools.yaml

## Setup desktop in my flavior

ansible-playbook Desktop-play/Install-gnome-extensions.yaml
