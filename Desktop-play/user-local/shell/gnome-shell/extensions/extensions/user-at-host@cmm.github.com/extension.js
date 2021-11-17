/*Derived from Simple-Username.  https://extensions.gnome.org/extension/807/simple-name/*/
const St = imports.gi.St;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;

let label;

function enable() {
    label = new St.Button({reactive: false,
                           can_focus: false,
                           track_hover: false,
                           label: GLib.get_user_name() + '@' + GLib.get_host_name()});
    let centerBoxChildren = Main.panel._centerBox.get_children();
    Main.panel._centerBox.insert_child_at_index(label, centerBoxChildren.length);
}

function disable() {
    Main.panel._centerBox.remove_child(label);
    label.destroy();
}
