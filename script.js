
const STORAGE_KEY = "demoBankAccountsV1";
const TRANSACTION_KEY = "demoBankTransactionsV1";

let accounts = [];
let transactions = [];
let editingId = null;

const $ = id => document.getElementById(id);

function loadData(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : JSON.parse(value);
    } catch {
        return fallback;
    }
}

function saveData() {
    try {
        // Save both datasets together before changing in-memory state.
        localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
        localStorage.setItem(
            TRANSACTION_KEY, JSON.stringify(transactions)
        );
        return true;
    } catch {
        showMessage("Storage unavailable. Changes may not be saved.", true);
        return false;
    }
}

function money(paise) {
    return (paise / 100).toLocaleString("en-IN", {
        style: "currency",
        currency: "INR"
    });
}

function parseAmount(value) {
    if (typeof value !== "string" || value.trim() === "") {
        return null;
    }

    const amount = Number(value);

    if (!Number.isFinite(amount) || amount < 0 ||
        !Number.isSafeInteger(Math.round(amount * 100))) {
        return null;
    }

    return Math.round(amount * 100);
}

function showMessage(text, error = false) {
    $("message").textContent = text;
    $("message").style.color = error ? "#d64545" : "#16855b";
}

function nextAccountId() {
    let id;
    do {
        id = String(Math.floor(1000000000 + Math.random() * 9000000000));
    } while (accounts.some(a => a.id === id));
    return id;
}

function escapeText(value) {
    // User-provided strings are rendered using textContent below.
    return String(value);
}

function render() {
    const query = $("searchInput").value.trim().toLowerCase();

    const visibleAccounts = accounts.filter(account =>
        account.id.toLowerCase().includes(query) ||
        account.name.toLowerCase().includes(query) ||
        account.type.toLowerCase().includes(query)
    );

    const accountTable = $("accountTable");
    accountTable.replaceChildren();

    $("emptyMessage").hidden = visibleAccounts.length > 0;

    visibleAccounts.forEach(account => {
        const row = document.createElement("tr");

        function cell(value) {
            const td = document.createElement("td");
            td.textContent = escapeText(value);
            row.appendChild(td);
            return td;
        }

        cell(account.id);
        cell(account.name);
        cell(account.type);
        cell(money(account.balance));

        const actionCell = cell("");
        const group = document.createElement("div");
        group.className = "action-group";

        function addButton(label, cssClass, handler) {
            const button = document.createElement("button");
            button.textContent = label;
            button.className = cssClass;
            button.addEventListener("click", handler);
            group.appendChild(button);
        }

        addButton("Edit", "edit-btn", () => editAccount(account.id));

        addButton("Deposit", "deposit-btn", () =>
            transact(account.id, "Deposit"));

        addButton("Withdraw", "withdraw-btn", () =>
            transact(account.id, "Withdrawal"));

        addButton("Delete", "delete-btn", () =>
            deleteAccount(account.id));

        actionCell.appendChild(group);
        accountTable.appendChild(row);
    });

    $("totalAccounts").textContent = accounts.length;

    const totalBalance = accounts.reduce(
        (sum, account) => sum + account.balance, 0
    );
    $("totalBalance").textContent = money(totalBalance);

    $("totalTransactions").textContent = transactions.length;

    const transactionTable = $("transactionTable");
    transactionTable.replaceChildren();

    $("noTransactions").hidden = transactions.length > 0;

    transactions.slice(0, 10).forEach(transaction => {
        const row = document.createElement("tr");

        [
            transaction.date,
            transaction.accountId,
            transaction.type,
            money(transaction.amount)
        ].forEach(value => {
            const td = document.createElement("td");
            td.textContent = String(value);
            row.appendChild(td);
        });

        transactionTable.appendChild(row);
    });
}

function recordTransaction(accountId, type, amount) {
    return {
        accountId,
        type,
        amount,
        date: new Date().toLocaleString("en-IN")
    };
}

// CREATE and UPDATE
$("accountForm").addEventListener("submit", event => {
    event.preventDefault();

    const name = $("holderName").value.trim();
    const type = $("accountType").value;
    const initialAmount = parseAmount($("initialDeposit").value);

    if (!name) {
        showMessage("Enter the account holder's name.", true);
        return;
    }

    if (!["Savings", "Current"].includes(type)) {
        showMessage("Select a valid account type.", true);
        return;
    }

    if (initialAmount === null) {
        showMessage("Enter a valid deposit amount.", true);
        return;
    }

    let newAccounts = [...accounts];
    let newTransactions = [...transactions];

    if (editingId !== null) {
        const index = newAccounts.findIndex(a => a.id === editingId);

        if (index === -1) {
            showMessage("Account not found.", true);
            return;
        }

        newAccounts[index] = {
            ...newAccounts[index],
            name,
            type
        };
    } else {
        const account = {
            id: nextAccountId(),
            name,
            type,
            balance: initialAmount
        };

        newAccounts.push(account);

        if (initialAmount > 0) {
            newTransactions.unshift(
                recordTransaction(account.id, "Opening Deposit", initialAmount)
            );
        }
    }

    const oldAccounts = accounts;
    const oldTransactions = transactions;

    accounts = newAccounts;
    transactions = newTransactions;

    if (!saveData()) {
        accounts = oldAccounts;
        transactions = oldTransactions;
        return;
    }

    closeForm();
    showMessage(editingId === null
        ? "Account created successfully."
        : "Account updated successfully.");

    render();
});

// READ is implemented by render().

function openForm() {
    editingId = null;
    $("accountForm").reset();
    $("initialDeposit").value = "0";
    $("initialDepositLabel").hidden = false;
    $("formTitle").textContent = "Create Bank Account";
    $("accountFormPanel").hidden = false;
    $("holderName").focus();
}

function closeForm() {
    editingId = null;
    $("accountFormPanel").hidden = true;
    $("accountForm").reset();
}

function editAccount(id) {
    const account = accounts.find(a => a.id === id);
    if (!account) return;

    editingId = id;
    $("holderName").value = account.name;
    $("accountType").value = account.type;
    $("initialDepositLabel").hidden = true;
    $("formTitle").textContent = "Update Account Details";
    $("accountFormPanel").hidden = false;
    $("holderName").focus();
}

// DELETE
function deleteAccount(id) {
    const account = accounts.find(a => a.id === id);
    if (!account) return;

    if (account.balance !== 0) {
        showMessage("Withdraw the remaining balance before deleting.", true);
        return;
    }

    if (!confirm("Delete account " + id + "? This cannot be undone.")) {
        return;
    }

    const oldAccounts = accounts;
    accounts = accounts.filter(a => a.id !== id);

    if (!saveData()) {
        accounts = oldAccounts;
        return;
    }

    showMessage("Account deleted successfully.");
    render();
}

// DEPOSIT and WITHDRAWAL
function transact(id, type) {
    const account = accounts.find(a => a.id === id);
    if (!account) return;

    const raw = prompt("Enter " + type.toLowerCase() + " amount in ₹:");
    if (raw === null) return;

    const amount = parseAmount(raw);

    if (amount === null || amount <= 0) {
        showMessage("Enter a valid amount greater than zero.", true);
        return;
    }

    if (type === "Withdrawal" && amount > account.balance) {
        showMessage("Insufficient balance.", true);
        return;
    }

    if (type === "Deposit" &&
        !Number.isSafeInteger(account.balance + amount)) {
        showMessage("Balance exceeds supported limit.", true);
        return;
    }

    const oldAccounts = accounts;
    const oldTransactions = transactions;

    accounts = accounts.map(a => {
        if (a.id !== id) return a;

        return {
            ...a,
            balance: type === "Deposit"
                ? a.balance + amount
                : a.balance - amount
        };
    });

    transactions = [
        recordTransaction(id, type, amount),
        ...transactions
    ];

    if (!saveData()) {
        accounts = oldAccounts;
        transactions = oldTransactions;
        return;
    }

    showMessage(type + " completed successfully.");
    render();
}

$("addAccountBtn").addEventListener("click", openForm);
$("cancelFormBtn").addEventListener("click", closeForm);
$("searchInput").addEventListener("input", render);

// Restore and validate locally stored demo data.
const savedAccounts = loadData(STORAGE_KEY, []);
const savedTransactions = loadData(TRANSACTION_KEY, []);

if (Array.isArray(savedAccounts) &&
    savedAccounts.every(a =>
        a &&
        typeof a.id === "string" &&
        typeof a.name === "string" &&
        ["Savings", "Current"].includes(a.type) &&
        Number.isSafeInteger(a.balance) &&
        a.balance >= 0
    )) {
    accounts = savedAccounts;
}

if (Array.isArray(savedTransactions) &&
    savedTransactions.every(t =>
        t &&
        typeof t.accountId === "string" &&
        typeof t.type === "string" &&
        Number.isSafeInteger(t.amount) &&
        t.amount > 0 &&
        typeof t.date === "string"
    )) {
    transactions = savedTransactions;
}

render();
