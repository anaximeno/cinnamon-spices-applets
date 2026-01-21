const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Settings = imports.ui.settings;
const Util = imports.misc.util;
const Lang = imports.lang;
const Gettext = imports.gettext;
const Tooltips = imports.ui.tooltips;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;

const UUID = "directory-menu@torchipeppo";

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");

function _(str) {
    let translated = Gettext.dgettext(UUID, str);
    if (translated !== str)
        return translated;
    return str;
}

class FolderMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(file, applet) {
        super();
        this._file = file;
        this._applet = applet;
        
        this.actor.add_style_class_name('popup-menu-item');
        
        // Group Icon and Label
        let box = new St.BoxLayout({ style_class: 'popup-menu-item-box',
                                     style: 'spacing: 6px;',
                                     x_align: Clutter.ActorAlign.START });
        
        // Use expand: true in addActor to push the arrow to the right
        this.addActor(box, { expand: true, span: 1, align: St.Align.START }); 

        // Icon
        this._icon = new St.Icon({ style_class: 'popup-menu-icon',
                                   icon_name: 'folder',
                                   icon_type: St.IconType.SYMBOLIC });
        box.add(this._icon);

        // Label
        this.label = new St.Label({ text: this._applet.formatLabel(file.get_basename()) });
        box.add(this.label);

        // Drill-down Arrow
        this._arrow = new St.Icon({ style_class: 'popup-menu-arrow',
                                    icon_name: 'go-next-symbolic',
                                    icon_type: St.IconType.SYMBOLIC });
        this.addActor(this._arrow, { align: St.Align.END });
        
        // Key navigation
        this.actor.connect('key-press-event', Lang.bind(this, this._onKeyPress));
    }
    
    setLoading(loading) {
        if (loading) {
            this._arrow.set_icon_name('process-working-symbolic');
        } else {
            this._arrow.set_icon_name('go-next-symbolic');
        }
    }

    _onKeyPress(actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol === Clutter.KEY_Right) {
            this.activate(event);
            return true;
        } else if (symbol === Clutter.KEY_Left) {
            this._applet.goUp();
            return true; 
        }
        return false;
    }

    activate(event) {
        // No need for idle_add here as we aren't destroying immediately.
        // The async operation will handle the timing.
        if (this._applet && this._applet.menu.isOpen) {
            this._applet.openChildFolder(this._file, this);
        }
    }
}

class FileMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(file, info, applet) {
        super();
        this._file = file;
        this._applet = applet;
        
        this.actor.add_style_class_name('popup-menu-item');

        let box = new St.BoxLayout({ style_class: 'popup-menu-item-box',
                                     style: 'spacing: 6px;',
                                     x_align: Clutter.ActorAlign.START,
                                     x_expand: true });
        this.addActor(box);

        let gicon = info.get_icon();
        let icon = new St.Icon({ gicon: gicon,
                                 style_class: 'popup-menu-icon',
                                 icon_type: St.IconType.SYMBOLIC });
        box.add(icon);

        this.label = new St.Label({ text: this._applet.formatLabel(file.get_basename()) });
        box.add(this.label);
        
        this.actor.connect('key-press-event', Lang.bind(this, this._onKeyPress));
    }
    
    _onKeyPress(actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol === Clutter.KEY_Left) {
            this._applet.goUp();
            return true; 
        }
        return false;
    }
    
    activate(event) {
        Gio.app_info_launch_default_for_uri(this._file.get_uri(), null);
        this._applet.menu.close();
    }
}

class CassettoneApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.metadata = metadata;
        
        // Settings bindings
        this.settings = new Settings.AppletSettings(this, UUID, this.instance_id);
        this.settings.bind("starting-uri", "starting_uri", this.on_settings_changed);
        this.settings.bind("show-hidden", "show_hidden", this.on_settings_changed);
        this.settings.bind("icon-name", "icon_name", this.set_applet_icon_symbolic_name);
        this.settings.bind("label", "label", this.set_applet_label);
        this.settings.bind("tooltip", "tooltip_text", (txt) => this.set_applet_tooltip(_(txt)));
        this.settings.bind("show-menu", "show_menu", this.set_keybinding);
        this.settings.bind("limit-characters", "limit_characters", this.on_settings_changed);
        this.settings.bind("character-limit", "character_limit", this.on_settings_changed);
        this.settings.bind("order-by", "order_by", this.on_settings_changed);
        // this.settings.bind("favorites-first", "favorites_first", this.on_settings_changed); 
        // this.settings.bind("pinned-first", "pinned_first", this.on_settings_changed);

        this._normalizeStartingUri();
        this.currentDir = null; // Will track where we are

        this.set_applet_tooltip(_(this.tooltip_text || "Directory Menu"));
        this.set_applet_icon_symbolic_name(this.icon_name || "folder");
        this.set_show_label_in_vertical_panels(false);
        this.set_applet_label(this.label || "");

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        
        // Reset to starting directory when menu closes
        this.menu.connect('open-state-changed', (menu, isOpen) => {
            if (!isOpen) {
                 // Reset after a short delay to allow closing animation or logic to complete
                 Mainloop.timeout_add(200, () => {
                     // Verify menu is still closed to avoid race conditions
                     if (!this.menu.isOpen) {
                         this.enterFolder(Gio.File.new_for_uri(this.starting_uri));
                     }
                     return false;
                 });
            }
        });
        
        // --- LAYOUT ---
        // 1. Header (Static at top)
        this._buildHeader();
        
        // 2. Separator
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // 3. Scrollable List
        this.scroll = new St.ScrollView({
            style_class: 'vfade',
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            enable_mouse_scrolling: true
        });
        
        // Ensure scrolling content is clipped so it doesn't render under transparent header areas
        this.scroll.set_clip_to_allocation(true);
        
        this.menuBox = new St.BoxLayout({ vertical: true });
        this.scroll.add_actor(this.menuBox);
        this.menu.addActor(this.scroll);

        // Initial Load
        this.enterFolder(Gio.File.new_for_uri(this.starting_uri));
        
        this.set_keybinding();
    }
    
    _buildHeader() {
        // We want a horizontal box for navigation controls
        // [ < Back ] [ Current Folder Name ] [ Open ] [ Term ]
        
        // reactive: true ensures clicks on empty space/label don't fall through to underlying actors
        let headerBox = new St.BoxLayout({ style_class: 'header-box', 
                                           style: 'padding: 6px 10px; spacing: 10px;', 
                                           reactive: true });
        
        // Back Button
        this.backButton = new St.Button({ style_class: 'popup-menu-item', style: 'padding: 4px;' });
        let backIcon = new St.Icon({ icon_name: 'go-previous-symbolic', icon_type: St.IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
        this.backButton.set_child(backIcon);
        this.backButton.connect('clicked', () => this.goUp());
        headerBox.add(this.backButton);
        
        // Folder Name (Expand to push buttons to right, or just center?)
        this.headerLabel = new St.Label({ text: "...", style: 'font-weight: bold; padding-top: 4px;' });
        headerBox.add(this.headerLabel, { expand: true, y_align: Clutter.ActorAlign.CENTER });
        
        // Open Folder
        let openBtn = new St.Button({ style_class: 'popup-menu-item', style: 'padding: 4px;' });
        let openTooltip = new Tooltips.Tooltip(openBtn, _("Open Folder"));
        let openIcon = new St.Icon({ icon_name: 'folder-open-symbolic', icon_type: St.IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
        openBtn.set_child(openIcon);
        openBtn.connect('clicked', () => {
            Gio.app_info_launch_default_for_uri(this.currentDir.get_uri(), null);
            this.menu.close();
        });
        headerBox.add(openBtn);
        
        // Open Terminal
        let termBtn = new St.Button({ style_class: 'popup-menu-item', style: 'padding: 4px;' });
        let termTooltip = new Tooltips.Tooltip(termBtn, _("Open in Terminal"));
        let termIcon = new St.Icon({ icon_name: 'utilities-terminal-symbolic', icon_type: St.IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
        termBtn.set_child(termIcon);
        termBtn.connect('clicked', () => {
            Util.spawnCommandLine("gnome-terminal --working-directory=" + GLib.shell_quote(this.currentDir.get_path()));
            this.menu.close();
        });
        headerBox.add(termBtn);

        this.menu.addActor(headerBox);
    }
    
    _updateHeader() {
        if (!this.currentDir) return;
        
        let name = this.currentDir.get_basename();
        // If Root is home or similar, might want nicer name, but basename is safe usually.
        // If currentDir == starting_uri, disable Back.
        
        let startFile = Gio.File.new_for_uri(this.starting_uri);
        let isRoot = this.currentDir.equal(startFile);
        
        if (isRoot) {
            this.backButton.hide();
            // Use custom label if configured for root?
            // name = this.label || name; 
        } else {
            this.backButton.show();
        }
        
        this.headerLabel.set_text(this.formatLabel(name));
    }
    
    _normalizeStartingUri() {
         let path = this.starting_uri;
         if (!path) {
             path = GLib.get_home_dir();
         } else if (path.startsWith("file://")) {
             // ok
         } else if (path.startsWith("~")) {
             path = GLib.get_home_dir() + path.slice(1);
             path = "file://" + path;
         } else {
             path = "file://" + path;
         }
         this.starting_uri = path;
    }

    on_settings_changed() {
        this._normalizeStartingUri();
        // Reset to root
        this.enterFolder(Gio.File.new_for_uri(this.starting_uri));
    }

    goUp() {
        if (!this.currentDir) return;
        let parent = this.currentDir.get_parent();
        if (parent) {
             // Also defer here just in case related to the button handling
             Mainloop.idle_add(() => {
                 this.enterFolder(parent);
                 return false;
             });
        }
    }

    openChildFolder(file, menuItem) {
        if (menuItem) menuItem.setLoading(true);

        let attributes = "standard::name,standard::type,standard::is-hidden,standard::icon,standard::display-name";
        if (this.order_by == 1) { // Date modified
             attributes += ",time::modified";
        }
        
        file.enumerate_children_async(
            attributes,
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            null,
            (obj, res) => {
                try {
                    if (!this.menu.isOpen) return;

                    let enumerator = obj.enumerate_children_finish(res);
                    this.enterFolder(file, enumerator);
                } catch (e) {
                    global.logError("Error enumerating: " + e);
                    if (menuItem) menuItem.setLoading(false);
                }
            }
        );
    }

    enterFolder(file, enumerator = null) {
        this.currentDir = file;
        this._updateHeader();
        
        // Ensure we don't lose focus when destroying items which would cause the menu to close
        if (this.menu && this.menu.actor && this.menu.actor.mapped) {
            this.menu.actor.grab_key_focus();
        }

        if (enumerator) {
             this.menuBox.destroy_all_children();
             this._addFilesToMenu(enumerator);
        } else {
             this.populateCurrentDir();
        }
    }

    populateCurrentDir() {
        this.menuBox.destroy_all_children();
        
        // Show loading spinner
        let spinnerBox = new St.BoxLayout({ style: 'padding: 10px;', x_align: Clutter.ActorAlign.CENTER });
        let spinner = new St.Icon({ style_class: 'popup-menu-icon', icon_name: 'process-working-symbolic', icon_type: St.IconType.SYMBOLIC });
        spinnerBox.add(spinner);
        this.menuBox.add_actor(spinnerBox);
        
        // attributes to query
        let attributes = "standard::name,standard::type,standard::is-hidden,standard::icon,standard::display-name";
        if (this.order_by == 1) { // Date modified
             attributes += ",time::modified";
        }
        
        this.currentDir.enumerate_children_async(
            attributes,
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            null,
            (file, res) => {
                try {
                    let enumerator = file.enumerate_children_finish(res);
                    this._addFilesToMenu(enumerator);
                } catch (e) {
                    global.logError("Error enumerating: " + e);
                    this.menuBox.destroy_all_children(); // Remove spinner
                    let label = new St.Label({ text: _("Empty or Access Denied"), style_class: 'popup-menu-item' });
                    this.menuBox.add_actor(label);
                }
            }
        );
    }

    _addFilesToMenu(enumerator) {
        // Clear spinner
        this.menuBox.destroy_all_children();

        let info;
        let files = [];
        while ((info = enumerator.next_file(null)) != null) {
            if (this.show_hidden || !info.get_is_hidden()) {
                files.push(info);
            }
        }
        
         files.sort((a, b) => {
            let typeA = a.get_file_type();
            let typeB = b.get_file_type();

            // Directories always first
            if (typeA == Gio.FileType.DIRECTORY && typeB != Gio.FileType.DIRECTORY) return -1;
            if (typeA != Gio.FileType.DIRECTORY && typeB == Gio.FileType.DIRECTORY) return 1;
            
            if (this.order_by == 1) { // Date modified
                // time::modified is uint64, usually seconds + microseconds?
                // GLib.FileInfo.get_modification_date_time() returns GLib.DateTime
                // or get_attribute_uint64("time::modified")
                
                let dateA = a.get_attribute_uint64("time::modified");
                let dateB = b.get_attribute_uint64("time::modified");
                // Newest first?
                return dateB - dateA;
            } else {
                // Name (default)
                let nameA = a.get_name().toLowerCase();
                let nameB = b.get_name().toLowerCase();

                if (nameA < nameB) return -1;
                if (nameA > nameB) return 1;
                return 0;
            }
        });
        
        if (files.length === 0) {
             let label = new St.Label({ text: _("Empty"), style: 'padding: 10px;', style_class: 'popup-inactive-menu-item' });
             this.menuBox.add_actor(label);
             return;
        }

        files.forEach(info => {
             let childFile = this.currentDir.get_child(info.get_name());
             let isDir = info.get_file_type() == Gio.FileType.DIRECTORY;
             
             let item;
             if (isDir) {
                 item = new FolderMenuItem(childFile, this); 
             } else {
                 item = new FileMenuItem(childFile, info, this);
             }
             this.menuBox.add_actor(item.actor);
        });
    }

    formatLabel(text) {
        if (this.limit_characters && text.length > this.character_limit) {
            let limit = Math.max(this.character_limit, 3);
            if (limit <= 3) return "...";
            
            let available = limit - 3;
            let part1 = Math.ceil(available / 2);
            let part2 = Math.floor(available / 2);
            
            return text.slice(0, part1) + "..." + text.slice(-part2);
        }
        return text;
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }
    
    set_keybinding() {
        Main.keybindingManager.addHotKey("show-directory-menu-" + this.instance_id,
            this.show_menu,
            Lang.bind(this, this.on_applet_clicked));
    }
    
    on_applet_removed_from_panel() {
        Main.keybindingManager.removeHotKey("show-directory-menu-" + this.instance_id);
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CassettoneApplet(metadata, orientation, panel_height, instance_id);
}
