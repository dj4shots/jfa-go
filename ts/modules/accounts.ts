import { _get, _post, _delete, toggleLoader, addLoader, removeLoader, toDateString, insertText, toClipboard } from "../modules/common.js";
import { templateEmail } from "../modules/settings.js";
import { Marked } from "@ts-stack/markdown";
import { stripMarkdown } from "../modules/stripmd.js";
import { DiscordUser, newDiscordSearch } from "../modules/discord.js";
const dateParser = require("any-date-parser");

interface User {
    id: string;
    name: string;
    email: string | undefined;
    notify_email: boolean;
    last_active: number;
    admin: boolean;
    disabled: boolean;
    expiry: number;
    telegram: string;
    notify_telegram: boolean;
    discord: string;
    notify_discord: boolean;
    discord_id: string;
    matrix: string;
    notify_matrix: boolean;
    label: string;
    accounts_admin: boolean;
}

interface getPinResponse {
    token: string;
    username: string;
}

interface announcementTemplate {
    name: string;
    subject: string;
    message: string;
}

var addDiscord: (passData: string) => void;

class user implements User {
    private _id = "";
    private _row: HTMLTableRowElement;
    private _check: HTMLInputElement;
    private _username: HTMLSpanElement;
    private _admin: HTMLSpanElement;
    private _disabled: HTMLSpanElement;
    private _email: HTMLInputElement;
    private _notifyEmail: boolean;
    private _emailAddress: string;
    private _emailEditButton: HTMLElement;
    private _telegram: HTMLTableDataCellElement;
    private _telegramUsername: string;
    private _notifyTelegram: boolean;
    private _discord: HTMLTableDataCellElement;
    private _discordUsername: string;
    private _discordID: string;
    private _notifyDiscord: boolean;
    private _matrix: HTMLTableDataCellElement;
    private _matrixID: string;
    private _notifyMatrix: boolean;
    private _expiry: HTMLTableDataCellElement;
    private _expiryUnix: number;
    private _lastActive: HTMLTableDataCellElement;
    private _lastActiveUnix: number;
    private _notifyDropdown: HTMLDivElement;
    private _label: HTMLInputElement;
    private _userLabel: string;
    private _labelEditButton: HTMLElement;
    private _accounts_admin: HTMLInputElement
    private _selected: boolean;

    lastNotifyMethod = (): string => {
        // Telegram, Matrix, Discord
        const telegram = window.telegramEnabled && this._telegramUsername && this._telegramUsername != "";
        const discord = window.discordEnabled && this._discordUsername && this._discordUsername != "";
        const matrix = window.matrixEnabled && this._matrixID && this._matrixID != "";
        const email = window.emailEnabled && this.email != "";
        if (discord) return "discord";
        if (matrix) return "matrix";
        if (telegram) return "telegram";
        if (email) return "email";
    }

    private _checkUnlinkArea = () => {
        const unlinkHeader = this._notifyDropdown.querySelector(".accounts-unlink-header") as HTMLSpanElement;
        if (this.lastNotifyMethod() == "email" || !this.lastNotifyMethod()) {
            unlinkHeader.classList.add("unfocused");
        } else {
            unlinkHeader.classList.remove("unfocused");
        }
    }

    get selected(): boolean { return this._selected; }
    set selected(state: boolean) {
        this._selected = state;
        this._check.checked = state;
        state ? document.dispatchEvent(this._checkEvent) : document.dispatchEvent(this._uncheckEvent);
    }

    get name(): string { return this._username.textContent; }
    set name(value: string) { this._username.textContent = value; }

    get admin(): boolean { return this._admin.classList.contains("chip"); }
    set admin(state: boolean) {
        if (state) {
            this._admin.classList.add("chip", "~info", "ml-4");
            this._admin.textContent = window.lang.strings("admin");
        } else {
            this._admin.classList.remove("chip", "~info", "ml-4");
            this._admin.textContent = "";
        }
    }

    get accounts_admin(): boolean { return this._accounts_admin.checked; }
    set accounts_admin(a: boolean) {
        if (!window.jellyfinLogin) return;
        this._accounts_admin.checked = a;
        this._accounts_admin.disabled = (window.jfAllowAll || (a && this.admin && window.jfAdminOnly));
        if (this._accounts_admin.disabled) {
            this._accounts_admin.title = window.lang.strings("accessJFASettings");
        } else {
            this._accounts_admin.title = "";
        }
    }

    get disabled(): boolean { return this._disabled.classList.contains("chip"); }
    set disabled(state: boolean) {
        if (state) {
            this._disabled.classList.add("chip", "~warning", "ml-4");
            this._disabled.textContent = window.lang.strings("disabled");
        } else {
            this._disabled.classList.remove("chip", "~warning", "ml-4");
            this._disabled.textContent = "";
        }
    }

    get email(): string { return this._emailAddress; }
    set email(value: string) {
        this._emailAddress = value;
        const input = this._email.querySelector("input");
        if (input) {
            input.value = value;
        } else {
            this._email.textContent = value;
        }
        const lastNotifyMethod = this.lastNotifyMethod() == "email";
        if (!value) {
            this._notifyDropdown.querySelector(".accounts-area-email").classList.add("unfocused");
        } else {
            this._notifyDropdown.querySelector(".accounts-area-email").classList.remove("unfocused");
            if (lastNotifyMethod) {
                (this._email.parentElement as HTMLDivElement).appendChild(this._notifyDropdown);
            }
        }
    }

    get notify_email(): boolean { return this._notifyEmail; }
    set notify_email(s: boolean) {
        if (this._notifyDropdown) {
            (this._notifyDropdown.querySelector(".accounts-contact-email") as HTMLInputElement).checked = s;
        }
    }

    private _constructDropdown = (): HTMLDivElement => {
        const el = document.createElement("div") as HTMLDivElement;
        const telegram = this._telegramUsername != "";
        const discord = this._discordUsername != "";
        const matrix = this._matrixID != "";
        const email = this._emailAddress != "";
        if (!telegram && !discord && !matrix && !email) return;
        let innerHTML = `
        <i class="icon ri-settings-2-line ml-2 dropdown-button"></i>
        <div class="dropdown over-top manual">
            <div class="dropdown-display lg">
                <div class="card ~neutral @low">
                    <div class="supra sm mb-2">${window.lang.strings("contactThrough")}</div>
                    <div class="accounts-area-email">
                        <label class="row switch pb-2">
                            <input type="checkbox" name="accounts-contact-${this.id}" class="accounts-contact-email mr-2">
                            </span>Email</span>
                        </label>
                    </div>
                    <div class="accounts-area-telegram">
                        <label class="row switch pb-2">
                            <input type="checkbox" name="accounts-contact-${this.id}" class="accounts-contact-telegram mr-2">
                            <span>Telegram</span>
                        </label>
                    </div>
                    <div class="accounts-area-discord">
                        <label class="row switch pb-2">
                            <input type="checkbox" name="accounts-contact-${this.id}" class="accounts-contact-discord mr-2">
                            <span>Discord</span>
                        </label>
                    </div>
                    <div class="accounts-area-matrix">
                        <label class="row switch pb-2">
                            <input type="checkbox" name="accounts-contact-${this.id}" class="accounts-contact-matrix mr-2">
                            <span>Matrix</span>
                        </label>
                    </div>
                    <div class="supra sm mb-2 accounts-unlink-header">${window.lang.strings("unlink")}:</div>
                    <div class="accounts-unlink-telegram"> 
                        <button class="button ~critical mb-2 w-100">Telegram</button>
                    </div>
                    <div class="accounts-unlink-discord"> 
                        <button class="button ~critical mb-2 w-100">Discord</button>
                    </div>
                    <div class="accounts-unlink-matrix"> 
                        <button class="button ~critical mb-2 w-100">Matrix</button>
                    </div>
                </div>
            </div>
        </div>
        `;
        el.innerHTML = innerHTML;
        const button = el.querySelector("i");
        const dropdown = el.querySelector("div.dropdown") as HTMLDivElement;
        const checks = el.querySelectorAll("input") as NodeListOf<HTMLInputElement>;
        for (let i = 0; i < checks.length; i++) {
            checks[i].onclick = () => this._setNotifyMethod();
        }
        
        for (let service of ["telegram", "discord", "matrix"]) {
            el.querySelector(".accounts-unlink-"+service).addEventListener("click", () => _delete(`/users/${service}`, {"id": this.id}, () => document.dispatchEvent(new CustomEvent("accounts-reload"))));
        }

        button.onclick = () => {
            dropdown.classList.add("selected");
            document.addEventListener("click", outerClickListener);
        };
        const outerClickListener = (event: Event) => {
            if (!(event.target instanceof HTMLElement && (el.contains(event.target) || button.contains(event.target)))) {
                dropdown.classList.remove("selected");
                document.removeEventListener("click", outerClickListener);
            }
        };
        return el;
    }

    get matrix(): string { return this._matrixID; }
    set matrix(u: string) {
        if (!window.matrixEnabled) {
            this._notifyDropdown.querySelector(".accounts-area-matrix").classList.add("unfocused");
            this._notifyDropdown.querySelector(".accounts-unlink-matrix").classList.add("unfocused");
            return;
        }
        const lastNotifyMethod = this.lastNotifyMethod() == "matrix";
        this._matrixID = u;
        if (!u) {
            this._notifyDropdown.querySelector(".accounts-area-matrix").classList.add("unfocused");
            this._notifyDropdown.querySelector(".accounts-unlink-matrix").classList.add("unfocused");
            this._matrix.innerHTML = `
            <div class="table-inline justify-center">
                <span class="chip btn @low"><i class="ri-link" alt="${window.lang.strings("add")}"></i></span>
                <input type="text" class="input ~neutral @low stealth-input unfocused" placeholder="@user:riot.im">
            </div>
            `;
            (this._matrix.querySelector("span") as HTMLSpanElement).onclick = this._addMatrix;
        } else {
            this._notifyDropdown.querySelector(".accounts-area-matrix").classList.remove("unfocused");
            this._notifyDropdown.querySelector(".accounts-unlink-matrix").classList.remove("unfocused");
            this._matrix.innerHTML = `
            <div class="table-inline">
                ${u}
            </div>
            `;
            if (lastNotifyMethod) {
                (this._matrix.querySelector(".table-inline") as HTMLDivElement).appendChild(this._notifyDropdown);
            }
        }
        this._checkUnlinkArea();
    }
   
    private _addMatrix = () => {
        const addButton = this._matrix.querySelector(".btn") as HTMLSpanElement;
        const input = this._matrix.querySelector("input.stealth-input") as HTMLInputElement;
        const addIcon = addButton.querySelector("i");
        if (addButton.classList.contains("chip")) {
            input.classList.remove("unfocused");
            addIcon.classList.add("ri-check-line");
            addIcon.classList.remove("ri-link");
            addButton.classList.remove("chip")
            const outerClickListener = (event: Event) => {
                if (!(event.target instanceof HTMLElement && (this._matrix.contains(event.target) || addButton.contains(event.target)))) {
                    document.dispatchEvent(new CustomEvent("accounts-reload"));
                    document.removeEventListener("click", outerClickListener);
                }
            };
            document.addEventListener("click", outerClickListener);
        } else {
            if (input.value.charAt(0) != "@" || !input.value.includes(":")) return;
            const send = {
                jf_id: this.id,
                user_id: input.value
            }
            _post("/users/matrix", send, (req: XMLHttpRequest) => {
                if (req.readyState == 4) {
                    document.dispatchEvent(new CustomEvent("accounts-reload"));
                    if (req.status != 200) {
                        window.notifications.customError("errorConnectMatrix", window.lang.notif("errorFailureCheckLogs"));
                        return;
                    }
                    window.notifications.customSuccess("connectMatrix", window.lang.notif("accountConnected"));
                }
            });
        }
    }

    get notify_matrix(): boolean { return this._notifyMatrix; }
    set notify_matrix(s: boolean) {
        if (this._notifyDropdown) {
            (this._notifyDropdown.querySelector(".accounts-contact-matrix") as HTMLInputElement).checked = s;
        }
    }
    
    get telegram(): string { return this._telegramUsername; }
    set telegram(u: string) {
        if (!window.telegramEnabled) {
            this._notifyDropdown.querySelector(".accounts-area-telegram").classList.add("unfocused");
            this._notifyDropdown.querySelector(".accounts-unlink-telegram").classList.add("unfocused");
            return;
        }
        const lastNotifyMethod = this.lastNotifyMethod() == "telegram";
        this._telegramUsername = u;
        if (!u) {
            this._notifyDropdown.querySelector(".accounts-area-telegram").classList.add("unfocused");
            this._notifyDropdown.querySelector(".accounts-unlink-telegram").classList.add("unfocused");
            this._telegram.innerHTML = `<div class="table-inline justify-center"><span class="chip btn @low"><i class="ri-link" alt="${window.lang.strings("add")}"></i></span></div>`;
            (this._telegram.querySelector("span") as HTMLSpanElement).onclick = this._addTelegram;
        } else {
            this._notifyDropdown.querySelector(".accounts-area-telegram").classList.remove("unfocused");
            this._notifyDropdown.querySelector(".accounts-unlink-telegram").classList.remove("unfocused");
            this._telegram.innerHTML = `
            <div class="table-inline">
                <a href="https://t.me/${u}" target="_blank">@${u}</a>
            </div>
            `;
            if (lastNotifyMethod) {
                (this._telegram.querySelector(".table-inline") as HTMLDivElement).appendChild(this._notifyDropdown);
            }
        }
        this._checkUnlinkArea();
    }
    
    get notify_telegram(): boolean { return this._notifyTelegram; }
    set notify_telegram(s: boolean) {
        if (this._notifyDropdown) {
            (this._notifyDropdown.querySelector(".accounts-contact-telegram") as HTMLInputElement).checked = s;
        }
    }

    private _setNotifyMethod = () => {
        const email = this._notifyDropdown.getElementsByClassName("accounts-contact-email")[0] as HTMLInputElement;
        let send = {
            id: this.id,
            email: email.checked
        }
        if (window.telegramEnabled && this._telegramUsername) {
            const telegram = this._notifyDropdown.getElementsByClassName("accounts-contact-telegram")[0] as HTMLInputElement;
            send["telegram"] = telegram.checked;
        }
        if (window.discordEnabled && this._discordUsername) {
            const discord = this._notifyDropdown.getElementsByClassName("accounts-contact-discord")[0] as HTMLInputElement;
            send["discord"] = discord.checked;
        }
        _post("/users/contact", send, (req: XMLHttpRequest) => {
            if (req.readyState == 4) {
                if (req.status != 200) {
                    window.notifications.customError("errorSetNotify", window.lang.notif("errorSaveSettings"));
                    document.dispatchEvent(new CustomEvent("accounts-reload"));
                    return;
                }
            }
        }, false, (req: XMLHttpRequest) => {
            if (req.status == 0) {
                window.notifications.connectionError();
                document.dispatchEvent(new CustomEvent("accounts-reload"));
                return;
            } else if (req.status == 401) {
                window.notifications.customError("401Error", window.lang.notif("error401Unauthorized"));
                document.dispatchEvent(new CustomEvent("accounts-reload"));
            }
        });
    }
    
    get discord(): string { return this._discordUsername; }
    set discord(u: string) {
        if (!window.discordEnabled) {
            this._notifyDropdown.querySelector(".accounts-area-discord").classList.add("unfocused");
            this._notifyDropdown.querySelector(".accounts-unlink-discord").classList.add("unfocused");
            return;
        }
        const lastNotifyMethod = this.lastNotifyMethod() == "discord";
        this._discordUsername = u;
        if (!u) {
            this._discord.innerHTML = `<div class="table-inline justify-center"><span class="chip btn @low"><i class="ri-link" alt="${window.lang.strings("add")}"></i></span></div>`;
            (this._discord.querySelector("span") as HTMLSpanElement).onclick = () => addDiscord(this.id);
            this._notifyDropdown.querySelector(".accounts-area-discord").classList.add("unfocused");
            this._notifyDropdown.querySelector(".accounts-unlink-discord").classList.add("unfocused");
        } else {
            this._notifyDropdown.querySelector(".accounts-area-discord").classList.remove("unfocused");
            this._notifyDropdown.querySelector(".accounts-unlink-discord").classList.remove("unfocused");
            this._discord.innerHTML = `
            <div class="table-inline">
                <a href="https://discord.com/users/${this._discordID}" class="discord-link" target="_blank">${u}</a>
            </div>
            `;
            if (lastNotifyMethod) {
                (this._discord.querySelector(".table-inline") as HTMLDivElement).appendChild(this._notifyDropdown);
            }
        }
        this._checkUnlinkArea();
    }

    get discord_id(): string { return this._discordID; }
    set discord_id(id: string) {
        if (!window.discordEnabled || this._discordUsername == "") return; 
        this._discordID = id;
        const link = this._discord.getElementsByClassName("discord-link")[0] as HTMLAnchorElement;
        link.href = `https://discord.com/users/${id}`;
    }
    
    get notify_discord(): boolean { return this._notifyDiscord; }
    set notify_discord(s: boolean) {
        if (this._notifyDropdown) {
            (this._notifyDropdown.querySelector(".accounts-contact-discord") as HTMLInputElement).checked = s;
        }
    }

    get expiry(): number { return this._expiryUnix; }
    set expiry(unix: number) {
        this._expiryUnix = unix;
        if (unix == 0) {
            this._expiry.textContent = "";
        } else {
            this._expiry.textContent = toDateString(new Date(unix*1000));
        }
    }

    get last_active(): number { return this._lastActiveUnix; }
    set last_active(unix: number) {
        this._lastActiveUnix = unix;
        if (unix == 0) {
            this._lastActive.textContent == "n/a";
        } else {
            this._lastActive.textContent = toDateString(new Date(unix*1000));
        }
    }

    get label(): string { return this._userLabel; }
    set label(l: string) {
        this._userLabel = l ? l : "";
        this._label.innerHTML = l ? l : "";
        this._labelEditButton.classList.add("ri-edit-line");
        this._labelEditButton.classList.remove("ri-check-line");
        if (!l) {
            this._label.classList.remove("chip", "~gray");
        } else {
            this._label.classList.add("chip", "~gray", "mr-2");
        }
    }

    matchesSearch = (query: string): boolean => {
        return (
            this.name.includes(query) ||
            this.label.includes(query) ||
            this.discord.includes(query) ||
            this.email.includes(query) ||
            this.id.includes(query) ||
            this.label.includes(query) ||
            this.matrix.includes(query) ||
            this.telegram.includes(query)
        );
    }

    private _checkEvent = new CustomEvent("accountCheckEvent");
    private _uncheckEvent = new CustomEvent("accountUncheckEvent");

    constructor(user: User) {
        this._row = document.createElement("tr") as HTMLTableRowElement;
        let innerHTML = `
            <td><input type="checkbox" class="accounts-select-user" value=""></td>
            <td><div class="table-inline"><span class="accounts-username py-2 mr-2"></span><span class="accounts-label-container ml-2"></span> <i class="icon ri-edit-line accounts-label-edit"></i> <span class="accounts-admin"></span> <span class="accounts-disabled"></span></span></div></td>
        `;
        if (window.jellyfinLogin) {
            innerHTML += `
            <td><div class="table-inline justify-center"><input type="checkbox" class="accounts-access-jfa" value=""></div></td>
            `;
        }
        innerHTML += `
            <td><div class="table-inline"><i class="icon ri-edit-line accounts-email-edit"></i><span class="accounts-email-container ml-2"></span></div></td>
        `;
        if (window.telegramEnabled) {
            innerHTML += `
            <td class="accounts-telegram"></td>
            `;
        }
        if (window.matrixEnabled) {
            innerHTML += `
            <td class="accounts-matrix"></td>
            `;
        }
        if (window.discordEnabled) {
            innerHTML += `
            <td class="accounts-discord"></td>
            `;
        }
        innerHTML += `
        <td class="accounts-expiry"></td>
        <td class="accounts-last-active whitespace-nowrap"></td>
        `;
        this._row.innerHTML = innerHTML;
        const emailEditor = `<input type="email" class="input ~neutral @low stealth-input">`;
        const labelEditor = `<input type="text" class="field ~neutral @low stealth-input">`;
        this._check = this._row.querySelector("input[type=checkbox].accounts-select-user") as HTMLInputElement;
        this._accounts_admin = this._row.querySelector("input[type=checkbox].accounts-access-jfa") as HTMLInputElement;
        this._username = this._row.querySelector(".accounts-username") as HTMLSpanElement;
        this._admin = this._row.querySelector(".accounts-admin") as HTMLSpanElement;
        this._disabled = this._row.querySelector(".accounts-disabled") as HTMLSpanElement;
        this._email = this._row.querySelector(".accounts-email-container") as HTMLInputElement;
        this._emailEditButton = this._row.querySelector(".accounts-email-edit") as HTMLElement;
        this._telegram = this._row.querySelector(".accounts-telegram") as HTMLTableDataCellElement;
        this._discord = this._row.querySelector(".accounts-discord") as HTMLTableDataCellElement;
        this._matrix = this._row.querySelector(".accounts-matrix") as HTMLTableDataCellElement;
        this._expiry = this._row.querySelector(".accounts-expiry") as HTMLTableDataCellElement;
        this._lastActive = this._row.querySelector(".accounts-last-active") as HTMLTableDataCellElement;
        this._label = this._row.querySelector(".accounts-label-container") as HTMLInputElement;
        this._labelEditButton = this._row.querySelector(".accounts-label-edit") as HTMLElement;
        this._check.onchange = () => { this.selected = this._check.checked; }
        
        if (window.jellyfinLogin) {
            this._accounts_admin.onchange = () => {
                this.accounts_admin = this._accounts_admin.checked;
                let send = {};
                send[this.id] = this.accounts_admin;
                _post("/users/accounts-admin", send, (req: XMLHttpRequest) => {
                    if (req.readyState == 4) {
                        if (req.status != 204) {
                            this.accounts_admin = !this.accounts_admin;
                            window.notifications.customError("accountsAdminChanged", window.lang.notif("errorUnknown"));
                        }
                    }
                });
            };
        }

        this._notifyDropdown = this._constructDropdown();

        const toggleEmailInput = () => {
            if (this._emailEditButton.classList.contains("ri-edit-line")) {
                this._email.innerHTML = emailEditor;
                this._email.querySelector("input").value = this._emailAddress;
                this._email.classList.remove("ml-2");
            } else {
                this._email.textContent = this._emailAddress;
                this._email.classList.add("ml-2");
            }
            this._emailEditButton.classList.toggle("ri-check-line");
            this._emailEditButton.classList.toggle("ri-edit-line");
        };
        const emailClickListener = (event: Event) => {
            if (!(event.target instanceof HTMLElement && (this._email.contains(event.target) || this._emailEditButton.contains(event.target)))) {
                toggleEmailInput();
                this.email = this.email;
                document.removeEventListener("click", emailClickListener);
            }
        };
        this._emailEditButton.onclick = () => {
            if (this._emailEditButton.classList.contains("ri-edit-line")) {
                document.addEventListener('click', emailClickListener);
            } else {
                this._updateEmail();
                document.removeEventListener('click', emailClickListener);
            }
            toggleEmailInput();
        };
        
        const toggleLabelInput = () => {
            if (this._labelEditButton.classList.contains("ri-edit-line")) {
                this._label.innerHTML = labelEditor;
                const input = this._label.querySelector("input");
                input.value = this._userLabel;
                input.placeholder = window.lang.strings("label");
                this._label.classList.remove("ml-2");
                this._labelEditButton.classList.add("ri-check-line");
                this._labelEditButton.classList.remove("ri-edit-line");
            } else {
                this._updateLabel();
                this._email.classList.add("ml-2");
            }
        };
        
        const labelClickListener = (event: Event) => {
            if (!(event.target instanceof HTMLElement && (this._label.contains(event.target) || this._labelEditButton.contains(event.target)))) {
                toggleLabelInput();
                document.removeEventListener("click", labelClickListener);
            }
        };

        this._labelEditButton.onclick = () => {
            if (this._labelEditButton.classList.contains("ri-edit-line")) {
                document.addEventListener('click', labelClickListener);
            } else {
                document.removeEventListener('click', labelClickListener);
            }
            toggleLabelInput();
        };

        this.update(user);
        
        document.addEventListener("timefmt-change", () => {
            this.expiry = this.expiry;
            this.last_active = this.last_active;
        });
    }
    
    private _updateLabel = () => {
        let oldLabel = this.label;
        this.label = this._label.querySelector("input").value;
        let send = {};
        send[this.id] = this.label;
        _post("/users/labels", send, (req: XMLHttpRequest) => {
            if (req.readyState == 4) {
                if (req.status != 204) {
                    this.label = oldLabel;
                    window.notifications.customError("labelChanged", window.lang.notif("errorUnknown"));
                }
            }
        });
    };

    private _updateEmail = () => {
        let oldEmail = this.email;
        this.email = this._email.querySelector("input").value;
        let send = {};
        send[this.id] = this.email;
        _post("/users/emails", send, (req: XMLHttpRequest) => {
            if (req.readyState == 4) {
                if (req.status == 200) {
                    window.notifications.customSuccess("emailChanged", window.lang.var("notifications", "changedEmailAddress", `"${this.name}"`));
                } else {
                    this.email = oldEmail;
                    window.notifications.customError("emailChanged", window.lang.var("notifications", "errorChangedEmailAddress", `"${this.name}"`)); 
                }
            }
        });
    }
    
    private _addTelegram = () => _get("/telegram/pin", null, (req: XMLHttpRequest) => {
        if (req.readyState == 4 && req.status == 200) {
            const pin = document.getElementById("telegram-pin");
            const link = document.getElementById("telegram-link") as HTMLAnchorElement;
            const username = document.getElementById("telegram-username") as HTMLSpanElement;
            const waiting = document.getElementById("telegram-waiting") as HTMLSpanElement;
            let resp = req.response as getPinResponse;
            pin.textContent = resp.token;
            link.href = "https://t.me/" + resp.username;
            username.textContent = resp.username;
            addLoader(waiting);
            let modalClosed = false;
            window.modals.telegram.onclose = () => { 
                modalClosed = true;
                removeLoader(waiting);
            }
            let send = {
                token: resp.token,
                id: this.id
            };
            const checkVerified = () => _post("/users/telegram", send, (req: XMLHttpRequest) => {
                if (req.readyState == 4) {
                    if (req.status == 200 && req.response["success"] as boolean) {
                        removeLoader(waiting);
                        waiting.classList.add("~positive");
                        waiting.classList.remove("~info");
                        window.notifications.customSuccess("telegramVerified", window.lang.notif("telegramVerified"));
                        setTimeout(() => {
                            window.modals.telegram.close();
                            waiting.classList.add("~info");
                            waiting.classList.remove("~positive");
                        }, 2000);
                        document.dispatchEvent(new CustomEvent("accounts-reload"));
                    } else if (!modalClosed) {
                        setTimeout(checkVerified, 1500);
                    }
                }
            }, true);
            window.modals.telegram.show();
            checkVerified();
        }
    });

    get id() { return this._id; }
    set id(v: string) { this._id = v; }


    update = (user: User) => {
        this.id = user.id;
        this.name = user.name;
        this.email = user.email || "";
        // Little hack to get settings cogs to appear on first load
        this._discordUsername = user.discord;
        this._telegramUsername = user.telegram;
        this._matrixID = user.matrix;
        this.discord = user.discord;
        this.telegram = user.telegram;
        this.matrix = user.matrix;
        this.last_active = user.last_active;
        this.admin = user.admin;
        this.disabled = user.disabled;
        this.expiry = user.expiry;
        this.notify_discord = user.notify_discord;
        this.notify_telegram = user.notify_telegram;
        this.notify_matrix = user.notify_matrix;
        this.notify_email = user.notify_email;
        this.discord_id = user.discord_id;
        this.label = user.label;
        this.accounts_admin = user.accounts_admin;
    }

    asElement = (): HTMLTableRowElement => { return this._row; }
    remove = () => {
        if (this.selected) {
            document.dispatchEvent(this._uncheckEvent);
        }
        this._row.remove(); 
    }
}    

export class accountsList {
    private _table = document.getElementById("accounts-list") as HTMLTableSectionElement;
    
    private _addUserButton = document.getElementById("accounts-add-user") as HTMLSpanElement;
    private _announceButton = document.getElementById("accounts-announce") as HTMLSpanElement;
    private _announceSaveButton = document.getElementById("save-announce") as HTMLSpanElement;
    private _announceNameLabel = document.getElementById("announce-name") as HTMLLabelElement;
    private _announcePreview: HTMLElement;
    private _previewLoaded = false;
    private _announceTextarea = document.getElementById("textarea-announce") as HTMLTextAreaElement;
    private _deleteUser = document.getElementById("accounts-delete-user") as HTMLSpanElement;
    private _disableEnable = document.getElementById("accounts-disable-enable") as HTMLSpanElement;
    private _enableExpiry = document.getElementById("accounts-enable-expiry") as HTMLSpanElement;
    private _deleteNotify = document.getElementById("delete-user-notify") as HTMLInputElement;
    private _deleteReason = document.getElementById("textarea-delete-user") as HTMLTextAreaElement;
    private _extendExpiry = document.getElementById("accounts-extend-expiry") as HTMLSpanElement;
    private _enableExpiryNotify = document.getElementById("expiry-extend-enable") as HTMLInputElement;
    private _enableExpiryReason = document.getElementById("textarea-extend-enable") as HTMLTextAreaElement;
    private _modifySettings = document.getElementById("accounts-modify-user") as HTMLSpanElement;
    private _modifySettingsProfile = document.getElementById("radio-use-profile") as HTMLInputElement;
    private _modifySettingsUser = document.getElementById("radio-use-user") as HTMLInputElement;
    private _sendPWR = document.getElementById("accounts-send-pwr") as HTMLSpanElement;
    private _profileSelect = document.getElementById("modify-user-profiles") as HTMLSelectElement;
    private _userSelect = document.getElementById("modify-user-users") as HTMLSelectElement;
    private _search = document.getElementById("accounts-search") as HTMLInputElement;

    private _selectAll = document.getElementById("accounts-select-all") as HTMLInputElement;
    private _users: { [id: string]: user };
    private _ordering: string[] = [];
    private _checkCount: number = 0;
    private _inSearch = false;
    // Whether the enable/disable button should enable or not.
    private _shouldEnable = false;

    private _addUserForm = document.getElementById("form-add-user") as HTMLFormElement;
    private _addUserName = this._addUserForm.querySelector("input[type=text]") as HTMLInputElement;
    private _addUserEmail = this._addUserForm.querySelector("input[type=email]") as HTMLInputElement;
    private _addUserPassword = this._addUserForm.querySelector("input[type=password]") as HTMLInputElement;
    private _addUserProfile = this._addUserForm.querySelector("select") as HTMLSelectElement;
    
    // Columns for sorting.
    private _columns: { [className: string]: Column } = {};
    private _activeSortColumn: string;

    private _sortingByButton = document.getElementById("accounts-sort-by-field") as HTMLButtonElement;
    private _filterArea = document.getElementById("accounts-filter-area");
    private _searchOptionsHeader = document.getElementById("accounts-search-options-header");

    // Whether the "Extend expiry" is extending or setting an expiry.
    private _settingExpiry = false;

    private _count = 30;
    private _populateNumbers = () => {
        const fieldIDs = ["months", "days", "hours", "minutes"];
        const prefixes = ["extend-expiry-"];
        for (let i = 0; i < fieldIDs.length; i++) {
            for (let j = 0; j < prefixes.length; j++) { 
                const field = document.getElementById(prefixes[j] + fieldIDs[i]);
                field.textContent = '';
                for (let n = 0; n <= this._count; n++) {
                   const opt = document.createElement("option") as HTMLOptionElement;
                   opt.textContent = ""+n;
                   opt.value = ""+n;
                   field.appendChild(opt);
                }
            }
        }
    }

    showHideSearchOptionsHeader = () => {
        const sortingBy = !(this._sortingByButton.parentElement.classList.contains("hidden"));
        const hasFilters = this._filterArea.textContent != "";
        console.log("sortingBy", sortingBy, "hasFilters", hasFilters);
        if (sortingBy || hasFilters) {
            this._searchOptionsHeader.classList.remove("hidden");
        } else {
            this._searchOptionsHeader.classList.add("hidden");
        }
    }

    private _queries: { [field: string]: { name: string, getter: string, bool: boolean, string: boolean, date: boolean, dependsOnTableHeader?: string, show?: boolean }} = {
        "id": {
            // We don't use a translation here to circumvent the name substitution feature.
            name: "Jellyfin/Emby ID",
            getter: "id",
            bool: false,
            string: true,
            date: false
        },
        "label": {
            name: window.lang.strings("label"),
            getter: "label",
            bool: true,
            string: true,
            date: false
        },
        "username": {
            name: window.lang.strings("username"),
            getter: "name",
            bool: false,
            string: true,
            date: false
        },
        "name": {
            name: window.lang.strings("username"),
            getter: "name",
            bool: false,
            string: true,
            date: false,
            show: false
        },
        "admin": {
            name: window.lang.strings("admin"),
            getter: "admin",
            bool: true,
            string: false,
            date: false
        },
        "disabled": {
            name: window.lang.strings("disabled"),
            getter: "disabled",
            bool: true,
            string: false,
            date: false
        },
        "access-jfa": {
            name: window.lang.strings("accessJFA"),
            getter: "accounts_admin",
            bool: true,
            string: false,
            date: false,
            dependsOnTableHeader: "accounts-header-access-jfa"
        },
        "email": {
            name: window.lang.strings("emailAddress"),
            getter: "email",
            bool: true,
            string: true,
            date: false,
            dependsOnTableHeader: "accounts-header-email"
        },
        "telegram": {
            name: "Telegram",
            getter: "telegram",
            bool: true,
            string: true,
            date: false,
            dependsOnTableHeader: "accounts-header-telegram"
        },
        "matrix": {
            name: "Matrix",
            getter: "matrix",
            bool: true,
            string: true,
            date: false,
            dependsOnTableHeader: "accounts-header-matrix"
        },
        "discord": {
            name: "Discord",
            getter: "discord",
            bool: true,
            string: true,
            date: false,
            dependsOnTableHeader: "accounts-header-discord"
        },
        "expiry": {
            name: window.lang.strings("expiry"),
            getter: "expiry",
            bool: true,
            string: false,
            date: true,
            dependsOnTableHeader: "accounts-header-expiry"
        },
        "last-active": {
            name: window.lang.strings("lastActiveTime"),
            getter: "last_active",
            bool: true,
            string: false,
            date: true
        }
    }

    search = (query: String): string[] => {
        console.log(this._queries);
        this._filterArea.textContent = "";

        query = query.toLowerCase();
        let result: string[] = [...this._ordering];
        // console.log("initial:", result);

        // const words = query.split(" ");
        let words: string[] = [];
        // FIXME: SPLIT BY SPACE, UNLESS IN QUOTES
        
        let quoteSymbol = ``;
        let queryStart = -1;
        let lastQuote = -1;
        for (let i = 0; i < query.length; i++) {
            if (queryStart == -1 && query[i] != " " && query[i] != `"` && query[i] != `'`) {
                queryStart = i;
            }
            if ((query[i] == `"` || query[i] == `'`) && (quoteSymbol == `` || query[i] == quoteSymbol)) {
                if (lastQuote != -1) {
                    lastQuote = -1;
                    quoteSymbol = ``;
                } else {
                    lastQuote = i;
                    quoteSymbol = query[i];
                }
            }

            if (query[i] == " " || i == query.length-1) {
                if (lastQuote != -1) {
                    continue;
                } else {
                    let end = i+1;
                    if (query[i] == " ") {
                        end = i;
                        while (i+1 < query.length && query[i+1] == " ") {
                            i += 1;
                        }
                    }
                    words.push(query.substring(queryStart, end).replace(/['"]/g, ""));
                    console.log("pushed", words);
                    queryStart = -1;
                }
            }
        }

        query = "";
        for (let word of words) {
            if (!word.includes(":")) {
                let cachedResult = [...result];
                for (let id of cachedResult) {
                    const u = this._users[id];
                    if (!u.matchesSearch(word)) {
                        result.splice(result.indexOf(id), 1);
                    }
                }
                continue;
            }
            const split = [word.substring(0, word.indexOf(":")), word.substring(word.indexOf(":")+1)];
            
            if (!(split[0] in this._queries)) continue;

            const queryFormat = this._queries[split[0]];

            if (queryFormat.bool) {
                let isBool = false;
                let boolState = false;
                if (split[1] == "true" || split[1] == "yes" || split[1] == "t" || split[1] == "y") {
                    isBool = true;
                    boolState = true;
                } else if (split[1] == "false" || split[1] == "no" || split[1] == "f" || split[1] == "n") {
                    isBool = true;
                    boolState = false;
                }
                if (isBool) {
                    // FIXME: Generate filter card for each filter class
                    const filterCard = document.createElement("span");
                    filterCard.ariaLabel = window.lang.strings("clickToRemoveFilter");
                    filterCard.classList.add("button", "~" + (boolState ? "positive" : "critical"), "@high", "center", "mx-2", "h-full");
                    filterCard.innerHTML = `
                    <span class="font-bold mr-2">${queryFormat.name}</span>
                    <i class="text-2xl ri-${boolState? "checkbox" : "close"}-circle-fill"></i>
                    `;

                    filterCard.addEventListener("click", () => {
                        for (let quote of [`"`, `'`, ``]) {
                            this._search.value = this._search.value.replace(split[0] + ":" + quote + split[1] + quote, "");
                        }
                        this._search.oninput((null as Event));
                    })

                    this._filterArea.appendChild(filterCard);

                    // console.log("is bool, state", boolState);
                    // So removing elements doesn't affect us
                    let cachedResult = [...result];
                    for (let id of cachedResult) {
                        const u = this._users[id];
                        const value = Object.getOwnPropertyDescriptor(user.prototype, queryFormat.getter).get.call(u);
                        // console.log("got", queryFormat.getter + ":", value);
                        // Remove from result if not matching query
                        if (!((value && boolState) || (!value && !boolState))) {
                            // console.log("not matching, result is", result);
                            result.splice(result.indexOf(id), 1);
                        }
                    }
                    continue
                }
            }
            if (queryFormat.string) {
                const filterCard = document.createElement("span");
                filterCard.ariaLabel = window.lang.strings("clickToRemoveFilter");
                filterCard.classList.add("button", "~neutral", "@low", "center", "mx-2", "h-full");
                filterCard.innerHTML = `
                <span class="font-bold mr-2">${queryFormat.name}:</span> "${split[1]}"
                `;

                filterCard.addEventListener("click", () => {
                    for (let quote of [`"`, `'`, ``]) {
                        let regex = new RegExp(split[0] + ":" + quote + split[1] + quote, "ig");
                        this._search.value = this._search.value.replace(regex, "");
                    }
                    this._search.oninput((null as Event));
                })

                this._filterArea.appendChild(filterCard);

                let cachedResult = [...result];
                for (let id of cachedResult) {
                    const u = this._users[id];
                    const value = Object.getOwnPropertyDescriptor(user.prototype, queryFormat.getter).get.call(u);
                    if (!(value.includes(split[1]))) {
                        result.splice(result.indexOf(id), 1);
                    }
                }
                continue;
            }
            if (queryFormat.date) {
                // -1 = Before, 0 = On, 1 = After, 2 = No symbol, assume 0
                let compareType = (split[1][0] == ">") ? 1 : ((split[1][0] == "<") ? -1 : ((split[1][0] == "=") ? 0 : 2));
                let unmodifiedValue = split[1];
                if (compareType != 2) {
                    split[1] = split[1].substring(1);
                }
                if (compareType == 2) compareType = 0;

                let attempt: { year?: number, month?: number, day?: number, hour?: number, minute?: number } = dateParser.attempt(split[1]);
                // Month in Date objects is 0-based, so make our parsed date that way too
                if ("month" in attempt) attempt["month"] -= 1;

                let date: Date = (Date as any).fromString(split[1]) as Date;
                console.log("Read", attempt, "and", date);
                if ("invalid" in (date as any)) continue;

                const filterCard = document.createElement("span");
                filterCard.ariaLabel = window.lang.strings("clickToRemoveFilter");
                filterCard.classList.add("button", "~neutral", "@low", "center", "m-2", "h-full");
                filterCard.innerHTML = `
                <span class="font-bold mr-2">${queryFormat.name}:</span> ${(compareType == 1) ? window.lang.strings("after")+" " : ((compareType == -1) ? window.lang.strings("before")+" " : "")}${split[1]}
                `;
                
                filterCard.addEventListener("click", () => {
                    for (let quote of [`"`, `'`, ``]) {
                        let regex = new RegExp(split[0] + ":" + quote + unmodifiedValue + quote, "ig");
                        this._search.value = this._search.value.replace(regex, "");
                    }
                    
                    this._search.oninput((null as Event));
                })
                
                this._filterArea.appendChild(filterCard);

                let cachedResult = [...result];
                for (let id of cachedResult) {
                    const u = this._users[id];
                    const unixValue = Object.getOwnPropertyDescriptor(user.prototype, queryFormat.getter).get.call(u);
                    if (unixValue == 0) {
                        result.splice(result.indexOf(id), 1);
                        continue;
                    }
                    let value = new Date(unixValue*1000);
                    
                    const getterPairs: [string, () => number][] = [["year", Date.prototype.getFullYear], ["month", Date.prototype.getMonth], ["day", Date.prototype.getDate], ["hour", Date.prototype.getHours], ["minute", Date.prototype.getMinutes]];

                    // When doing > or < <time> with no date, we need to ignore the rest of the Date object
                    if (compareType != 0 && Object.keys(attempt).length == 2 && "hour" in attempt && "minute" in attempt) { 
                        const temp = new Date(date.valueOf());
                        temp.setHours(value.getHours(), value.getMinutes());
                        value = temp;
                        console.log("just hours/minutes workaround, value set to", value);
                    }


                    let match = true;
                    if (compareType == 0) {
                        for (let pair of getterPairs) {
                            if (pair[0] in attempt) {
                                if (compareType == 0 && attempt[pair[0]] != pair[1].call(value)) {
                                    match = false;
                                    break;
                                }
                            }
                        }
                    } else if (compareType == -1) {
                        match = (value < date);
                    } else if (compareType == 1) {
                        match = (value > date);
                    }
                    if (!match) {
                        result.splice(result.indexOf(id), 1);
                    }
                }
            }
        }
        return result
    };


    get selectAll(): boolean { return this._selectAll.checked; }
    set selectAll(state: boolean) {
        let count = 0;
        for (let id in this._users) {
            if (this._table.contains(this._users[id].asElement())) { // Only select visible elements
                this._users[id].selected = state;
                count++;
            }
        }
        this._selectAll.checked = state;
        this._selectAll.indeterminate = false;
        state ? this._checkCount = count : 0;
    }
    
    add = (u: User) => {
        let domAccount = new user(u);
        this._users[u.id] = domAccount;
    }

    private _checkCheckCount = () => {
        const list = this._collectUsers();
        this._checkCount = list.length;
        if (this._checkCount == 0) {
            this._selectAll.indeterminate = false;
            this._selectAll.checked = false;
            this._modifySettings.classList.add("unfocused");
            this._deleteUser.classList.add("unfocused");
            if (window.emailEnabled || window.telegramEnabled) {
                this._announceButton.parentElement.classList.add("unfocused");
            }
            this._extendExpiry.classList.add("unfocused");
            this._disableEnable.parentElement.classList.add("unfocused");
            this._sendPWR.classList.add("unfocused");
        } else {
            let visibleCount = 0;
            for (let id in this._users) {
                if (this._table.contains(this._users[id].asElement())) {
                    visibleCount++;
                }
            }
            if (this._checkCount == visibleCount) {
                this._selectAll.checked = true;
                this._selectAll.indeterminate = false;
            } else {
                this._selectAll.checked = false;
                this._selectAll.indeterminate = true;
            }
            this._modifySettings.classList.remove("unfocused");
            this._deleteUser.classList.remove("unfocused");
            this._deleteUser.textContent = window.lang.quantity("deleteUser", list.length);
            if (window.emailEnabled || window.telegramEnabled) {
                this._announceButton.parentElement.classList.remove("unfocused");
            }
            let anyNonExpiries = list.length == 0 ? true : false;
            let allNonExpiries = true;
            let noContactCount = 0;
            // Only show enable/disable button if all selected have the same state.
            this._shouldEnable = this._users[list[0]].disabled
            let showDisableEnable = true;
            for (let id of list) {
                if (!anyNonExpiries && !this._users[id].expiry) {
                    anyNonExpiries = true;
                    this._extendExpiry.classList.add("unfocused");
                }
                if (this._users[id].expiry) {
                    allNonExpiries = false;
                }
                if (showDisableEnable && this._users[id].disabled != this._shouldEnable) {
                    showDisableEnable = false;
                    this._disableEnable.parentElement.classList.add("unfocused");
                }
                if (!showDisableEnable && anyNonExpiries) { break; }
                if (!this._users[id].lastNotifyMethod()) {
                    noContactCount++;
                }
            }
            this._settingExpiry = false;
            if (!anyNonExpiries && !allNonExpiries) {
                this._extendExpiry.classList.remove("unfocused");
                this._extendExpiry.textContent = window.lang.strings("extendExpiry");
            }
            if (allNonExpiries) {
                this._extendExpiry.classList.remove("unfocused");
                this._extendExpiry.textContent = window.lang.strings("setExpiry");
                this._settingExpiry = true;
            }
            // Only show "Send PWR" if a maximum of 1 user selected doesn't have a contact method
            if (noContactCount > 1) {
                this._sendPWR.classList.add("unfocused");
            } else if (window.linkResetEnabled) {
                this._sendPWR.classList.remove("unfocused");
            }
            if (showDisableEnable) {
                let message: string;
                if (this._shouldEnable) {
                    this._disableEnable.parentElement.classList.remove("manual");
                    message = window.lang.strings("reEnable");
                    this._disableEnable.classList.add("~positive");
                    this._disableEnable.classList.remove("~warning");
                } else {
                    this._disableEnable.parentElement.classList.add("manual");
                    message = window.lang.strings("disable");
                    this._disableEnable.classList.add("~warning");
                    this._disableEnable.classList.remove("~positive");
                }
                this._disableEnable.parentElement.classList.remove("unfocused");
                this._disableEnable.textContent = message;
            }
        }
    }
    
    private _collectUsers = (): string[] => {
        let list: string[] = [];
        for (let id in this._users) {
            if (this._table.contains(this._users[id].asElement()) && this._users[id].selected) { list.push(id); }
        }
        return list;
    }

    private _addUser = (event: Event) => {
        event.preventDefault();
        const button = this._addUserForm.querySelector("span.submit") as HTMLSpanElement;
        const send = {
            "username": this._addUserName.value,
            "email": this._addUserEmail.value,
            "password": this._addUserPassword.value,
            "profile": this._addUserProfile.value,
        };
        for (let field in send) {
            if (!send[field]) {
                window.notifications.customError("addUserBlankField", window.lang.notif("errorBlankFields"));
                return;
            }
        }
        toggleLoader(button);
        _post("/users", send, (req: XMLHttpRequest) => {
            if (req.readyState == 4) {
                toggleLoader(button);
                if (req.status == 200 || (req.response["user"] as boolean)) {
                    window.notifications.customSuccess("addUser", window.lang.var("notifications", "userCreated", `"${send['username']}"`));
                    if (!req.response["email"]) {
                        window.notifications.customError("sendWelcome", window.lang.notif("errorSendWelcomeEmail"));
                        console.log("User created, but welcome email failed");
                    }
                } else {
                    window.notifications.customError("addUser", window.lang.var("notifications", "errorUserCreated", `"${send['username']}"`));
                }
                if (req.response["error"] as String) {
                    console.log(req.response["error"]);
                }

                this.reload();
                window.modals.addUser.close();
            }
        }, true);
    }
    loadPreview = () => {
        let content = this._announceTextarea.value;
        if (!this._previewLoaded) {
            content = stripMarkdown(content);
            this._announcePreview.textContent = content;
        } else {
            content = Marked.parse(content);
            this._announcePreview.innerHTML = content;
        }
    }
    saveAnnouncement = (event: Event) => {
        event.preventDefault();
        const form = document.getElementById("form-announce") as HTMLFormElement;
        const button = form.querySelector("span.submit") as HTMLSpanElement;
        if (this._announceNameLabel.classList.contains("unfocused")) {
            this._announceNameLabel.classList.remove("unfocused");
            form.onsubmit = this.saveAnnouncement;
            button.textContent = window.lang.get("strings", "saveAsTemplate");
            this._announceSaveButton.classList.add("unfocused");
            const details = document.getElementById("announce-details");
            details.classList.add("unfocused");
            return;
        }
        const name = (this._announceNameLabel.querySelector("input") as HTMLInputElement).value;
        if (!name) { return; }
        const subject = document.getElementById("announce-subject") as HTMLInputElement;
        let send: announcementTemplate = {
            name: name,
            subject: subject.value,
            message: this._announceTextarea.value
        }
        _post("/users/announce/template", send, (req: XMLHttpRequest) => {
            if (req.readyState == 4) {
                this.reload();
                toggleLoader(button);
                window.modals.announce.close();
                if (req.status != 200 && req.status != 204) {
                    window.notifications.customError("announcementError", window.lang.notif("errorFailureCheckLogs"));
                } else {
                    window.notifications.customSuccess("announcementSuccess", window.lang.notif("savedAnnouncement"));
                }
            }
        });
    }
    announce = (event?: Event, template?: announcementTemplate) => {
        const modalHeader = document.getElementById("header-announce");
        modalHeader.textContent = window.lang.quantity("announceTo", this._collectUsers().length);
        const form = document.getElementById("form-announce") as HTMLFormElement;
        let list = this._collectUsers();
        const button = form.querySelector("span.submit") as HTMLSpanElement;
        removeLoader(button);
        button.textContent = window.lang.get("strings", "send");
        const details = document.getElementById("announce-details");
        details.classList.remove("unfocused");
        this._announceSaveButton.classList.remove("unfocused");
        const subject = document.getElementById("announce-subject") as HTMLInputElement;
        this._announceNameLabel.classList.add("unfocused");
        if (template) {
            subject.value = template.subject;
            this._announceTextarea.value = template.message;
        } else {
            subject.value = "";
            this._announceTextarea.value = "";
        }
        form.onsubmit = (event: Event) => {
            event.preventDefault();
            toggleLoader(button);
            let send = {
                "users": list,
                "subject": subject.value,
                "message": this._announceTextarea.value
            }
            _post("/users/announce", send, (req: XMLHttpRequest) => {
                if (req.readyState == 4) {
                    toggleLoader(button);
                    window.modals.announce.close();
                    if (req.status != 200 && req.status != 204) {
                        window.notifications.customError("announcementError", window.lang.notif("errorFailureCheckLogs"));
                    } else {
                        window.notifications.customSuccess("announcementSuccess", window.lang.notif("sentAnnouncement"));
                    }
                }
            });
        };
        _get("/config/emails/Announcement", null, (req: XMLHttpRequest) => {
            if (req.readyState == 4) {
                const preview = document.getElementById("announce-preview") as HTMLDivElement;
                if (req.status != 200) {
                    preview.innerHTML = `<pre class="preview-content" class="font-mono bg-inherit"></pre>`;
                    window.modals.announce.show();
                    this._previewLoaded = false;
                    return;
                }
                    
                let templ = req.response as templateEmail;
                if (!templ.html) {
                    preview.innerHTML = `<pre class="preview-content" class="font-mono bg-inherit"></pre>`;
                    this._previewLoaded = false;
                } else {
                    preview.innerHTML = templ.html;
                    this._previewLoaded = true;
                }
                this._announcePreview = preview.getElementsByClassName("preview-content")[0] as HTMLElement;
                this.loadPreview();
                window.modals.announce.show();
            }
        });
    }
    loadTemplates = () => _get("/users/announce", null, (req: XMLHttpRequest) => {
        if (req.readyState == 4) {
            if (req.status != 200) {
                this._announceButton.nextElementSibling.children[0].classList.add("unfocused");
                return;
            }
            this._announceButton.nextElementSibling.children[0].classList.remove("unfocused");
            const list = req.response["announcements"] as string[];
            if (list.length == 0) {
                this._announceButton.nextElementSibling.children[0].classList.add("unfocused");
                return;
            }
            if (list.length > 0) {
                this._announceButton.innerHTML = `${window.lang.strings("announce")} <i class="ml-2 ri-arrow-drop-down-line"></i>`;
            }
            const dList = document.getElementById("accounts-announce-templates") as HTMLDivElement;
            dList.textContent = '';
            for (let name of list) {
                const el = document.createElement("div") as HTMLDivElement;
                el.classList.add("flex-expand", "ellipsis", "mt-2");
                el.innerHTML = `
                <span class="button ~neutral sm full-width accounts-announce-template-button">${name}</span><span class="button ~critical fr ml-4 accounts-announce-template-delete">&times;</span>
                `;
                (el.querySelector("span.accounts-announce-template-button") as HTMLSpanElement).onclick = () => {
                    _get("/users/announce/" + name, null, (req: XMLHttpRequest) => {
                        if (req.readyState == 4) {
                            let template: announcementTemplate;
                            if (req.status != 200) {
                                window.notifications.customError("getTemplateError", window.lang.notif("errorFailureCheckLogs"));
                            } else {
                                template = req.response;
                            }
                            this.announce(null, template);
                        }
                    });
                };
                (el.querySelector("span.accounts-announce-template-delete") as HTMLSpanElement).onclick = () => {
                    _delete("/users/announce/" + name, null, (req: XMLHttpRequest) => {
                        if (req.readyState == 4) {
                            if (req.status != 200) {
                                window.notifications.customError("deleteTemplateError", window.lang.notif("errorFailureCheckLogs"));
                            }
                            this.reload();
                        }
                    });
                };
                dList.appendChild(el);
            }
        }
    });

    private _enableDisableUsers = (users: string[], enable: boolean, notify: boolean, reason: string|null, post: (req: XMLHttpRequest) => void) => {
        let send = {
            "users": users,
            "enabled": enable,
            "notify": notify
        };
        if (reason) send["reason"] = reason;
        _post("/users/enable", send, post, true);
    };

    enableDisableUsers = () => {
        // We can share the delete modal for this
        const modalHeader = document.getElementById("header-delete-user");
        const form = document.getElementById("form-delete-user") as HTMLFormElement;
        const button = form.querySelector("span.submit") as HTMLSpanElement;
        let list = this._collectUsers();
        if (this._shouldEnable) {
            modalHeader.textContent = window.lang.quantity("reEnableUsers", list.length);
            button.textContent = window.lang.strings("reEnable");
            button.classList.add("~urge");
            button.classList.remove("~critical");
        } else {
            modalHeader.textContent = window.lang.quantity("disableUsers", list.length);
            button.textContent = window.lang.strings("disable");
            button.classList.add("~critical");
            button.classList.remove("~urge");
        }
        this._deleteNotify.checked = false;
        this._deleteReason.value = "";
        this._deleteReason.classList.add("unfocused");
        form.onsubmit = (event: Event) => {
            event.preventDefault();
            toggleLoader(button);
            this._enableDisableUsers(list, this._shouldEnable, this._deleteNotify.checked, this._deleteNotify ? this._deleteReason.value : null, (req: XMLHttpRequest) => {
                if (req.readyState == 4) {
                    toggleLoader(button);
                    window.modals.deleteUser.close();
                    if (req.status != 200 && req.status != 204) {
                        let errorMsg = window.lang.notif("errorFailureCheckLogs");
                        if (!("error" in req.response)) {
                            errorMsg = window.lang.notif("errorPartialFailureCheckLogs");
                        }
                        window.notifications.customError("deleteUserError", errorMsg);
                    } else if (this._shouldEnable) {
                        window.notifications.customSuccess("enableUserSuccess", window.lang.quantity("enabledUser", list.length));
                    } else {
                        window.notifications.customSuccess("disableUserSuccess", window.lang.quantity("disabledUser", list.length));
                    }
                    this.reload();
                }
            });
        }
        window.modals.deleteUser.show();
    }

    deleteUsers = () => {
        const modalHeader = document.getElementById("header-delete-user");
        let list = this._collectUsers();
        modalHeader.textContent = window.lang.quantity("deleteNUsers", list.length);
        const form = document.getElementById("form-delete-user") as HTMLFormElement;
        const button = form.querySelector("span.submit") as HTMLSpanElement;
        button.textContent = window.lang.strings("delete");
        button.classList.add("~critical");
        button.classList.remove("~urge");
        this._deleteNotify.checked = false;
        this._deleteReason.value = "";
        this._deleteReason.classList.add("unfocused");
        form.onsubmit = (event: Event) => {
            event.preventDefault();
            toggleLoader(button);
            let send = {
                "users": list,
                "notify": this._deleteNotify.checked,
                "reason": this._deleteNotify ? this._deleteReason.value : ""
            };
            _delete("/users", send, (req: XMLHttpRequest) => {
                if (req.readyState == 4) {
                    toggleLoader(button);
                    window.modals.deleteUser.close();
                    if (req.status != 200 && req.status != 204) {
                        let errorMsg = window.lang.notif("errorFailureCheckLogs");
                        if (!("error" in req.response)) {
                            errorMsg = window.lang.notif("errorPartialFailureCheckLogs");
                        }
                        window.notifications.customError("deleteUserError", errorMsg);
                    } else {
                        window.notifications.customSuccess("deleteUserSuccess", window.lang.quantity("deletedUser", list.length));
                    }
                    this.reload();
                }
            });
        };
        window.modals.deleteUser.show();
    }
    
    sendPWR = () => {
        addLoader(this._sendPWR);
        let list = this._collectUsers();
        let manualUser: user;
        for (let id of list) {
            let user = this._users[id];
            if (!user.lastNotifyMethod() && !user.email) {
                manualUser  = user;
                break;
            }
        }
        const messageBox = document.getElementById("send-pwr-note") as HTMLParagraphElement;
        let message: string;
        let send = {
            users: list
        };
        _post("/users/password-reset", send, (req: XMLHttpRequest) => {
            if (req.readyState != 4) return;
            removeLoader(this._sendPWR);
            let link: string;
            if (req.status == 200) {
                link = req.response["link"];
                if (req.response["manual"] as boolean) {
                    message = window.lang.var("strings", "sendPWRManual", manualUser.name);
                } else {
                    message = window.lang.strings("sendPWRSuccess") + " " + window.lang.strings("sendPWRSuccessManual");
                }
            } else if (req.status == 204) {
                    message = window.lang.strings("sendPWRSuccess");
            } else {
                window.notifications.customError("errorSendPWR", window.lang.strings("errorFailureCheckLogs"));
                return;
            }
            message += " " + window.lang.strings("sendPWRValidFor");
            messageBox.textContent = message;
            let linkButton = document.getElementById("send-pwr-link") as HTMLSpanElement;
            if (link) {
                linkButton.classList.remove("unfocused");
                linkButton.onclick = () => {
                    toClipboard(link);
                    linkButton.textContent = window.lang.strings("copied");
                    linkButton.classList.add("~positive");
                    linkButton.classList.remove("~urge");
                    setTimeout(() => {
                        linkButton.textContent = window.lang.strings("copy");
                        linkButton.classList.add("~urge");
                        linkButton.classList.remove("~positive");
                    }, 800);
                };
            } else {
                linkButton.classList.add("unfocused");
            }
            window.modals.sendPWR.show();
        }, true);
    }

    modifyUsers = () => {
        const modalHeader = document.getElementById("header-modify-user");
        modalHeader.textContent = window.lang.quantity("modifySettingsFor", this._collectUsers().length)
        let list = this._collectUsers();
        (() => {
            let innerHTML = "";
            for (const profile of window.availableProfiles) {
                innerHTML += `<option value="${profile}">${profile}</option>`;
            }
            this._profileSelect.innerHTML = innerHTML;
        })();

        (() => {
            let innerHTML = "";
            for (let id in this._users) {
                innerHTML += `<option value="${id}">${this._users[id].name}</option>`;
            }
            this._userSelect.innerHTML = innerHTML;
        })();

        const form = document.getElementById("form-modify-user") as HTMLFormElement;
        const button = form.querySelector("span.submit") as HTMLSpanElement;
        this._modifySettingsProfile.checked = true;
        this._modifySettingsUser.checked = false;
        form.onsubmit = (event: Event) => {
            event.preventDefault();
            toggleLoader(button);
            let send = {
                "apply_to": list,
                "homescreen": (document.getElementById("modify-user-homescreen") as HTMLInputElement).checked
            };
            if (this._modifySettingsProfile.checked && !this._modifySettingsUser.checked) { 
                send["from"] = "profile";
                send["profile"] = this._profileSelect.value;
            } else if (this._modifySettingsUser.checked && !this._modifySettingsProfile.checked) {
                send["from"] = "user";
                send["id"] = this._userSelect.value;
            }
            _post("/users/settings", send, (req: XMLHttpRequest) => {
                if (req.readyState == 4) {
                    toggleLoader(button);
                    if (req.status == 500) {
                        let response = JSON.parse(req.response);
                        let errorMsg = "";
                        if ("homescreen" in response && "policy" in response) {
                            const homescreen = Object.keys(response["homescreen"]).length;
                            const policy = Object.keys(response["policy"]).length;
                            if (homescreen != 0 && policy == 0) {
                                errorMsg = window.lang.notif("errorSettingsAppliedNoHomescreenLayout");
                            } else if (policy != 0 && homescreen == 0) {
                                errorMsg = window.lang.notif("errorHomescreenAppliedNoSettings");
                            } else if (policy != 0 && homescreen != 0) {
                                errorMsg = window.lang.notif("errorSettingsFailed");
                            }
                        } else if ("error" in response) {
                            errorMsg = response["error"];
                        }
                        window.notifications.customError("modifySettingsError", errorMsg);
                    } else if (req.status == 200 || req.status == 204) {
                        window.notifications.customSuccess("modifySettingsSuccess", window.lang.quantity("appliedSettings", this._collectUsers().length));
                    }
                    this.reload();
                    window.modals.modifyUser.close();
                }
            });
        };
        window.modals.modifyUser.show();
    }

    extendExpiry = (enableUser?: boolean) => {
        const list = this._collectUsers();
        let applyList: string[] = [];
        for (let id of list) {
            applyList.push(id);
        }
        this._enableExpiryReason.classList.add("unfocused");
        let header: string;
        if (enableUser) {
            header = window.lang.quantity("reEnableUsers", list.length);
            this._enableExpiryNotify.parentElement.classList.remove("unfocused");
            this._enableExpiryNotify.checked = false;
            this._enableExpiryReason.value = "";
        } else if (this._settingExpiry) {
            header = window.lang.quantity("setExpiry", list.length);
            this._enableExpiryNotify.parentElement.classList.add("unfocused");
        } else {
            header = window.lang.quantity("extendExpiry", applyList.length);
            this._enableExpiryNotify.parentElement.classList.add("unfocused");
        }
        document.getElementById("header-extend-expiry").textContent = header;
        const extend = () => {
            let send = { "users": applyList }
            for (let field of ["months", "days", "hours", "minutes"]) {
                send[field] = +(document.getElementById("extend-expiry-"+field) as HTMLSelectElement).value;
            }
            _post("/users/extend", send, (req: XMLHttpRequest) => {
                if (req.readyState == 4) {
                    if (req.status != 200 && req.status != 204) {
                        window.notifications.customError("extendExpiryError", window.lang.notif("errorFailureCheckLogs"));
                    } else {
                        window.notifications.customSuccess("extendExpiry", window.lang.quantity("extendedExpiry", applyList.length));
                    }
                    window.modals.extendExpiry.close()
                    this.reload();
                }
            });
        };
        const form = document.getElementById("form-extend-expiry") as HTMLFormElement;
        form.onsubmit = (event: Event) => {
            event.preventDefault();
            if (enableUser) {
                this._enableDisableUsers(applyList, true, this._enableExpiryNotify.checked, this._enableExpiryNotify ? this._enableExpiryReason.value : null, (req: XMLHttpRequest) => {
                    if (req.readyState == 4) {
                        if (req.status != 200 && req.status != 204) {
                            window.modals.extendExpiry.close();
                            let errorMsg = window.lang.notif("errorFailureCheckLogs");
                            if (!("error" in req.response)) {
                                errorMsg = window.lang.notif("errorPartialFailureCheckLogs");
                            }
                            window.notifications.customError("deleteUserError", errorMsg);
                            return;
                        }
                        extend();
                    }
                });
            } else {
                extend();
            }
        }
        window.modals.extendExpiry.show();
    }
    

    setVisibility = (users: string[], visible: boolean) => {
        this._table.textContent = "";
        for (let id of this._ordering) {
            if (visible && users.indexOf(id) != -1) {
                this._table.appendChild(this._users[id].asElement());
            } else if (!visible && users.indexOf(id) == -1) {
                this._table.appendChild(this._users[id].asElement());
            }
        }
    }

    private _populateAddUserProfiles = () => {
        this._addUserProfile.textContent = "";
        let innerHTML = `<option value="none">${window.lang.strings("inviteNoProfile")}</option>`;
        for (let i = 0; i < window.availableProfiles.length; i++) {
            innerHTML += `<option value="${window.availableProfiles[i]}" ${i == 0 ? "selected" : ""}>${window.availableProfiles[i]}</option>`;
        }
        this._addUserProfile.innerHTML = innerHTML;
    }

    constructor() {
        this._populateNumbers();
        this._users = {};
        this._selectAll.checked = false;
        this._selectAll.onchange = () => {
            this.selectAll = this._selectAll.checked;
        };
        document.addEventListener("accounts-reload", this.reload);
        document.addEventListener("accountCheckEvent", () => { this._checkCount++; this._checkCheckCount(); });
        document.addEventListener("accountUncheckEvent", () => { this._checkCount--; this._checkCheckCount(); });
        this._addUserButton.onclick = () => {
            this._populateAddUserProfiles();
            window.modals.addUser.toggle();
        };
        this._addUserForm.addEventListener("submit", this._addUser);

        this._deleteNotify.onchange = () => {
            if (this._deleteNotify.checked) {
                this._deleteReason.classList.remove("unfocused");
            } else {
                this._deleteReason.classList.add("unfocused");
            }
        };
        this._modifySettings.onclick = this.modifyUsers;
        this._modifySettings.classList.add("unfocused");
        const checkSource = () => {
            const profileSpan = this._modifySettingsProfile.nextElementSibling as HTMLSpanElement;
            const userSpan = this._modifySettingsUser.nextElementSibling as HTMLSpanElement;
            if (this._modifySettingsProfile.checked) {
                this._userSelect.parentElement.classList.add("unfocused");
                this._profileSelect.parentElement.classList.remove("unfocused")
                profileSpan.classList.add("@high");
                profileSpan.classList.remove("@low");
                userSpan.classList.remove("@high");
                userSpan.classList.add("@low");
            } else {
                this._userSelect.parentElement.classList.remove("unfocused");
                this._profileSelect.parentElement.classList.add("unfocused");
                userSpan.classList.add("@high");
                userSpan.classList.remove("@low");
                profileSpan.classList.remove("@high");
                profileSpan.classList.add("@low");
            }
        };
        this._modifySettingsProfile.onchange = checkSource;
        this._modifySettingsUser.onchange = checkSource;

        this._deleteUser.onclick = this.deleteUsers;
        this._deleteUser.classList.add("unfocused");

        this._announceButton.onclick = this.announce;
        this._announceButton.parentElement.classList.add("unfocused");

        this._extendExpiry.onclick = () => { this.extendExpiry(); };
        this._extendExpiry.classList.add("unfocused");

        this._disableEnable.onclick = this.enableDisableUsers;
        this._disableEnable.parentElement.classList.add("unfocused");

        this._enableExpiry.onclick = () => { this.extendExpiry(true); };
        this._enableExpiryNotify.onchange = () => {
            if (this._enableExpiryNotify.checked) {
                this._enableExpiryReason.classList.remove("unfocused");
            } else {
                this._enableExpiryReason.classList.add("unfocused");
            }
        };

        if (!window.usernameEnabled) {
            this._addUserName.classList.add("unfocused");
            this._addUserName = this._addUserEmail;
        }

        if (!window.linkResetEnabled) {
            this._sendPWR.classList.add("unfocused");
        } else {
            this._sendPWR.onclick = this.sendPWR;
        }
        /*if (!window.emailEnabled) {
            this._deleteNotify.parentElement.classList.add("unfocused");
            this._deleteNotify.checked = false;
        }*/

        const onchange = () => {
            const query = this._search.value;
            if (!query) {
                // this.setVisibility(this._ordering, true);
                this._inSearch = false;
            } else {
                this._inSearch = true;
                // this.setVisibility(this.search(query), true);
            }
            this.setVisibility(this.search(query), true);
            this._checkCheckCount();
            this.showHideSearchOptionsHeader();
        };
        this._search.oninput = onchange;

        const clearSearchButton = document.getElementById("accounts-search-clear") as HTMLSpanElement;
        clearSearchButton.addEventListener("click", () => {
            this._search.value = "";
            onchange();
        });

        this._announceTextarea.onkeyup = this.loadPreview;
        addDiscord = newDiscordSearch(window.lang.strings("linkDiscord"), window.lang.strings("searchDiscordUser"), window.lang.strings("add"), (user: DiscordUser, id: string) => { 
            _post("/users/discord", {jf_id: id, discord_id: user.id}, (req: XMLHttpRequest) => {
                if (req.readyState == 4) {
                    document.dispatchEvent(new CustomEvent("accounts-reload"));
                    if (req.status != 200) {
                        window.notifications.customError("errorConnectDiscord", window.lang.notif("errorFailureCheckLogs"));
                        return
                    }
                    window.notifications.customSuccess("discordConnected", window.lang.notif("accountConnected"));
                    window.modals.discord.close()
                }
            });
        });

        this._announceSaveButton.onclick = this.saveAnnouncement;
        const announceVarUsername = document.getElementById("announce-variables-username") as HTMLSpanElement;
        announceVarUsername.onclick = () => {
            insertText(this._announceTextarea, announceVarUsername.children[0].textContent);
            this.loadPreview();
        };

        const headerNames: string[] = ["username", "access-jfa", "email", "telegram", "matrix", "discord", "expiry", "last-active"];
        const headerGetters: string[] = ["name", "accounts_admin", "email", "telegram", "matrix", "discord", "expiry", "last_active"];
        for (let i = 0; i < headerNames.length; i++) {
            const header: HTMLTableHeaderCellElement = document.querySelector(".accounts-header-" + headerNames[i]) as HTMLTableHeaderCellElement;
            if (header !== null) {
                this._columns[header.className] = new Column(header, Object.getOwnPropertyDescriptor(user.prototype, headerGetters[i]).get);
            }
        }

        // Start off sorting by Name
        const defaultSort = () => {
            this._activeSortColumn = document.getElementsByClassName("accounts-header-" + headerNames[0])[0].className;
            document.dispatchEvent(new CustomEvent("header-click", { detail: this._activeSortColumn }));
            this._columns[this._activeSortColumn].ascending = true;
            this._columns[this._activeSortColumn].hideIcon();
            this._sortingByButton.parentElement.classList.add("hidden");
            this.showHideSearchOptionsHeader();
        };

        this._sortingByButton.parentElement.addEventListener("click", defaultSort);

        document.addEventListener("header-click", (event: CustomEvent) => {
            this._ordering = this._columns[event.detail].sort(this._users);
            this._activeSortColumn = event.detail;
            this._sortingByButton.innerHTML = this._columns[event.detail].buttonContent;
            this._sortingByButton.parentElement.classList.remove("hidden");
            // console.log("ordering by", event.detail, ": ", this._ordering);
            if (!(this._inSearch)) {
                this.setVisibility(this._ordering, true);
            } else {
                this.setVisibility(this.search(this._search.value), true);
            }
            this.showHideSearchOptionsHeader();
        });

        defaultSort();
        this.showHideSearchOptionsHeader();

        const filterList = document.getElementById("accounts-filter-list");

        const fillInFilter = (name: string, value: string, offset?: number) => {
            this._search.value = name + ":" + value + " " + this._search.value;
            this._search.focus();
            let newPos = name.length + 1 + value.length;
            if (typeof offset !== 'undefined')
                newPos += offset;
            this._search.setSelectionRange(newPos, newPos);
            this._search.oninput(null as any);
        };

        // Generate filter buttons
        for (let queryName of Object.keys(this._queries)) {
            const query = this._queries[queryName];
            if ("show" in query && !query.show) continue;
            if ("dependsOnTableHeader" in query && query.dependsOnTableHeader) {
                const el = document.querySelector("."+query.dependsOnTableHeader);
                if (el === null) continue;
            }

            const container = document.createElement("span") as HTMLSpanElement;
            container.classList.add("button", "button-xl", "~neutral", "@low", "mb-1", "mr-2");
            container.innerHTML = `<span class="mr-2">${query.name}</span>`;
            if (query.bool) {
                const pos = document.createElement("button") as HTMLButtonElement;
                pos.type = "button";
                pos.ariaLabel = `Filter by "${query.name}": True`;
                pos.classList.add("button", "~positive", "ml-2");
                pos.innerHTML = `<i class="ri-checkbox-circle-fill"></i>`;
                pos.addEventListener("click", () => fillInFilter(queryName, "true"));
                const neg = document.createElement("button") as HTMLButtonElement;
                neg.type = "button";
                neg.ariaLabel = `Filter by "${query.name}": False`;
                neg.classList.add("button", "~critical", "ml-2");
                neg.innerHTML = `<i class="ri-close-circle-fill"></i>`;
                neg.addEventListener("click", () => fillInFilter(queryName, "false"));

                container.appendChild(pos);
                container.appendChild(neg);
            }
            if (query.string) {
                const button = document.createElement("button") as HTMLButtonElement;
                button.type = "button";
                button.classList.add("button", "~urge", "ml-2");
                button.innerHTML = `<i class="ri-equal-line mr-2"></i>${window.lang.strings("matchText")}`;

                // Position cursor between quotes
                button.addEventListener("click", () => fillInFilter(queryName, `""`, -1));
                
                container.appendChild(button);
            }
            if (query.date) {
                const onDate = document.createElement("button") as HTMLButtonElement;
                onDate.type = "button";
                onDate.classList.add("button", "~urge", "ml-2");
                onDate.innerHTML = `<i class="ri-calendar-check-line mr-2"></i>On Date`;
                onDate.addEventListener("click", () => fillInFilter(queryName, `"="`, -1));

                const beforeDate = document.createElement("button") as HTMLButtonElement;
                beforeDate.type = "button";
                beforeDate.classList.add("button", "~urge", "ml-2");
                beforeDate.innerHTML = `<i class="ri-calendar-check-line mr-2"></i>Before Date`;
                beforeDate.addEventListener("click", () => fillInFilter(queryName, `"<"`, -1));

                const afterDate = document.createElement("button") as HTMLButtonElement;
                afterDate.type = "button";
                afterDate.classList.add("button", "~urge", "ml-2");
                afterDate.innerHTML = `<i class="ri-calendar-check-line mr-2"></i>After Date`;
                afterDate.addEventListener("click", () => fillInFilter(queryName, `">"`, -1));
                
                container.appendChild(onDate);
                container.appendChild(beforeDate);
                container.appendChild(afterDate);
            }

            filterList.appendChild(container);
        }
    }

    reload = () => {
        _get("/users", null, (req: XMLHttpRequest) => {
            if (req.readyState == 4 && req.status == 200) {
                // same method as inviteList.reload()
                let accountsOnDOM: { [id: string]: boolean } = {};
                for (let id in this._users) { accountsOnDOM[id] = true; }
                for (let u of (req.response["users"] as User[])) {
                    if (u.id in this._users) {
                        this._users[u.id].update(u);
                        delete accountsOnDOM[u.id];
                    } else {
                        this.add(u);
                    }
                }
                for (let id in accountsOnDOM) {
                    this._users[id].remove();
                    delete this._users[id];
                }
                // console.log("reload, so sorting by", this._activeSortColumn);
                this._ordering = this._columns[this._activeSortColumn].sort(this._users);
                if (!(this._inSearch)) {
                    this.setVisibility(this._ordering, true);
                } else {
                    this.setVisibility(this.search(this._search.value), true);
                }
                this._checkCheckCount();
            }
        });
        this.loadTemplates();
    }
}

type GetterReturnType = Boolean | boolean | String | Number | number;
type Getter = () => GetterReturnType;

// When a column is clicked, it broadcasts it's name and ordering to be picked up and stored by accountsList
// When list is refreshed, accountList calls method of the specific Column and re-orders accordingly.
// Listen for broadcast event from others, check its not us by comparing the header className in the message, then hide the arrow icon
class Column {
    private _header: HTMLTableHeaderCellElement;
    private _headerContent: string;
    private _getter: Getter;
    private _ascending: boolean;
    private _active: boolean;

    constructor(header: HTMLTableHeaderCellElement, getter: Getter) {
        this._header = header;
        this._headerContent = this._header.textContent;
        this._getter = getter;
        this._ascending = true;
        this._active = false;

        this._header.addEventListener("click", () => {
            // If we are the active sort column, a click means to switch between ascending/descending.
            if (this._active) {
                this._ascending = !this._ascending;
                console.log("was already active, switching direction to", this._ascending ? "ascending" : "descending");
            } else {
                console.log("wasn't active keeping direction as", this._ascending ? "ascending" : "descending");
            }
            this._active = true;
            this._header.setAttribute("aria-sort", this._headerContent);
            this.updateHeader();
            document.dispatchEvent(new CustomEvent("header-click", { detail: this._header.className }));
        });
        document.addEventListener("header-click", (event: CustomEvent) => {
            if (event.detail != this._header.className) {
                this._active = false;
                this._header.removeAttribute("aria-sort");
                this.hideIcon();
            }
        });
    }

    hideIcon = () => {
        this._header.textContent = this._headerContent;
    }

    updateHeader = () => {
        this._header.innerHTML = `
        <span class="">${this._headerContent}</span>
        <i class="ri-arrow-${this._ascending? "up" : "down"}-s-line" aria-hidden="true"></i>
        `;
    }

    // Returns the inner HTML to show in the "Sorting By" button.
    get buttonContent() {
        return `<span class="font-bold">` + window.lang.strings("sortingBy") + ": " + `</span>` + this._headerContent;
    }

    get ascending() { return this._ascending; }
    set ascending(v: boolean) {
        this._ascending = v;
        if (!this._active) return;
        this.updateHeader();
        this._header.setAttribute("aria-sort", this._headerContent);
        document.dispatchEvent(new CustomEvent("header-click", { detail: this._header.className }));
    }

    // Sorts the user list. previouslyActive is whether this column was previously sorted by, indicating that the direction should change.
    sort = (users: { [id: string]: user }): string[] => {
        let userIDs = Object.keys(users);
        userIDs.sort((a: string, b: string): number => {
            const av: GetterReturnType = this._getter.call(users[a]);
            const bv: GetterReturnType = this._getter.call(users[b]);
            if (av < bv) return this._ascending ? -1 : 1;
            if (av > bv) return this._ascending ? 1 : -1;
            return 0;
        });

        return userIDs;
    }
}
