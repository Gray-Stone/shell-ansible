## Some machine will have to create user

sudo useradd -U -m -G sudo leogray && sudo passwd leogray

# Use mainbook

`cli-mainbook.yaml` contains the full list of playbooks that setup CLI dev environment.

Run it directly:

```bash
ansible-playbook cli-mainbook.yaml
```

It now checks passwordless sudo first and asks for sudo password only when needed.

---
## Setup ubuntu desktop

```sh
ansible-playbook Desktop-play/UB-desktop-install.yaml
```

## Setup desktop dev environment

```sh
ansible-playbook Desktop-play/Install-desktop-dev-tools.yaml
```

## Setup desktop in my flavor

```sh
ansible-playbook Desktop-play/Install-gnome-extensions.yaml
```
