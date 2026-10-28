let provider;
let signer;
let bankContract;
let userAddress;

const connectBtn = document.getElementById("connectBtn");
const walletAddressDisplay = document.getElementById("walletAddress");
const contractAddressInput = document.getElementById("contractAddressInput");
const contractAbiInput = document.getElementById("contractAbiInput");
const loadContractBtn = document.getElementById("loadContractBtn");

const balanceDisplay = document.getElementById("balanceDisplay");
const checkBalanceBtn = document.getElementById("checkBalanceBtn");
const depositBtn = document.getElementById("depositBtn");
const withdrawBtn = document.getElementById("withdrawBtn");
const amountInput = document.getElementById("amountInput");
const statusMessage = document.getElementById("statusMessage");
const txHistoryList = document.getElementById("txHistoryList");

const stepWallet = document.getElementById("stepWallet");
const stepContract = document.getElementById("stepContract");
const chips = document.querySelectorAll(".chip");

let statusTimer;

// type: "success" | "info" | "error"
function showStatus(message, type = "success") {
    // รองรับโค้ดเดิมที่ส่ง true = error
    if (type === true) type = "error";
    if (type === false) type = "success";

    clearTimeout(statusTimer);
    statusMessage.hidden = false;
    statusMessage.textContent = message;
    statusMessage.className = `status-pill ${type}`;

    if (type === "success") {
        statusTimer = setTimeout(() => { statusMessage.hidden = true; }, 5000);
    }
}

function enableContractInteraction() {
    checkBalanceBtn.disabled = false;
    depositBtn.disabled = false;
    withdrawBtn.disabled = false;
}

// ปุ่มแสดงสถานะกำลังทำงาน ป้องกันการกดซ้ำ
function setBusy(buttons, busy) {
    buttons.forEach(btn => {
        btn.disabled = busy;
        btn.classList.toggle("loading", busy);
    });
}

function setAmount(value) {
    amountInput.value = value;
    chips.forEach(c => c.classList.toggle("active", c.dataset.amount === String(value)));
}

// ปุ่มจำนวนเงินด่วน
chips.forEach(chip => {
    chip.addEventListener("click", () => setAmount(chip.dataset.amount));
});
amountInput.addEventListener("input", () => {
    chips.forEach(c => c.classList.toggle("active", c.dataset.amount === amountInput.value));
});

// 1. เชื่อมต่อ MetaMask อย่างเดียว
connectBtn.addEventListener("click", async () => {
    if (typeof window.ethereum !== "undefined") {
        try {
            showStatus("Connecting to MetaMask...", "info");
            await window.ethereum.request({ method: "eth_requestAccounts" });

            provider = new ethers.providers.Web3Provider(window.ethereum);
            signer = provider.getSigner();
            userAddress = await signer.getAddress();

            walletAddressDisplay.textContent = `Connected: ${userAddress.substring(0, 6)}...${userAddress.substring(38)}`;
            connectBtn.textContent = "Wallet connected";
            connectBtn.disabled = true;
            loadContractBtn.disabled = false; // ปลดล็อกปุ่ม Load Contract

            stepWallet.classList.add("done");
            stepContract.classList.remove("locked");

            showStatus("Wallet connected! Now load your contract.");
        } catch (error) {
            showStatus(error.message, "error");
        }
    } else {
        showStatus("MetaMask not found. Please install it to use this app.", "error");
    }
});

// ถ้าสลับบัญชีหรือเครือข่ายใน MetaMask ให้รีโหลดหน้าเพื่อกันข้อมูลคลาดเคลื่อน
if (window.ethereum) {
    window.ethereum.on("accountsChanged", () => window.location.reload());
    window.ethereum.on("chainChanged", () => window.location.reload());
}

// 2. สร้าง Contract Instance จาก Input
loadContractBtn.addEventListener("click", async () => {
    const address = contractAddressInput.value.trim();
    const abiString = contractAbiInput.value.trim();

    if (!address || !abiString) {
        showStatus("Please fill in both the contract address and the ABI.", "error");
        return;
    }

    try {
        // แปลง String เป็น JSON Object
        const abi = JSON.parse(abiString);

        // ผูก Address และ ABI เข้ากับ Signer
        bankContract = new ethers.Contract(address, abi, signer);

        showStatus("Contract loaded!");
        loadContractBtn.textContent = "Contract loaded";
        loadContractBtn.disabled = true;
        contractAddressInput.disabled = true;
        contractAbiInput.disabled = true;
        stepContract.classList.add("done");

        enableContractInteraction();
        await getBalance(); // ดึงยอดทันทีที่โหลดเสร็จ
        await loadTransactionHistory(); // โหลดประวัติธุรกรรมทันที
    } catch (error) {
        console.error(error);
        showStatus("Couldn't load the contract. Check that the address is correct and the ABI is valid JSON.", "error");
    }
});

// 3. ฟังก์ชันการทำงานของ Contract
async function getBalance() {
    if (!bankContract) return;
    try {
        showStatus("Fetching balance...", "info");
        const balanceWei = await bankContract.checkBlance();
        const balanceEth = ethers.utils.formatEther(balanceWei);
        balanceDisplay.textContent = `${parseFloat(balanceEth).toFixed(4)} ETH`;
        showStatus("Balance updated.");
    } catch (error) {
        console.error(error);
        showStatus("Couldn't fetch your balance. Please try again.", "error");
    }
}

checkBalanceBtn.addEventListener("click", getBalance);

depositBtn.addEventListener("click", async () => {
    const amount = amountInput.value;
    if (!amount || amount <= 0) {
        showStatus("Enter an amount greater than 0.", "error");
        return;
    }

    const buttons = [depositBtn, withdrawBtn];
    try {
        setBusy(buttons, true);
        showStatus("Confirm the deposit in MetaMask...", "info");
        const amountWei = ethers.utils.parseEther(amount);
        const tx = await bankContract.deposit({ value: amountWei });

        showStatus("Waiting for blockchain confirmation...", "info");
        await tx.wait();

        showStatus("Deposit successful!");
        setAmount("");
        await getBalance();
        await loadTransactionHistory();
    } catch (error) {
        console.error(error);
        showStatus("Deposit failed or was cancelled.", "error");
    } finally {
        setBusy(buttons, false);
    }
});

withdrawBtn.addEventListener("click", async () => {
    const amount = amountInput.value;
    if (!amount || amount <= 0) {
        showStatus("Enter an amount greater than 0.", "error");
        return;
    }

    const buttons = [depositBtn, withdrawBtn];
    try {
        setBusy(buttons, true);
        showStatus("Confirm the withdrawal in MetaMask...", "info");
        const amountWei = ethers.utils.parseEther(amount);
        const tx = await bankContract.withdraw(amountWei);

        showStatus("Waiting for blockchain confirmation...", "info");
        await tx.wait();

        showStatus("Withdrawal successful!");
        setAmount("");
        await getBalance();
        await loadTransactionHistory();
    } catch (error) {
        console.error(error);
        showStatus("Withdrawal failed or was cancelled.", "error");
    } finally {
        setBusy(buttons, false);
    }
});

function setHistoryMessage(text, isError = false) {
    txHistoryList.innerHTML = "";
    const li = document.createElement("li");
    li.className = "empty-state" + (isError ? " error" : "");
    li.textContent = text; // textContent กัน XSS จากข้อความ error
    txHistoryList.appendChild(li);
}

async function loadTransactionHistory() {
    if (!bankContract || !userAddress) return;

    try {
        setHistoryMessage("Loading activity...");

        if (!bankContract.filters.Deposit || !bankContract.filters.Withdraw) {
            throw new Error("ABI ของคุณไม่มีข้อมูล Event Deposit/Withdraw กรุณาใช้ JSON ABI จาก Remix");
        }

        const depositFilter = bankContract.filters.Deposit(userAddress);
        const withdrawFilter = bankContract.filters.Withdraw(userAddress);

        const currentBlock = await provider.getBlockNumber();

        const fromBlock = currentBlock - 9000 > 0 ? currentBlock - 9000 : 0;

        const depositLogs = await bankContract.queryFilter(depositFilter, fromBlock, "latest");
        const withdrawLogs = await bankContract.queryFilter(withdrawFilter, fromBlock, "latest");

        const allLogs = [...depositLogs, ...withdrawLogs].sort((a, b) => b.blockNumber - a.blockNumber);

        if (allLogs.length === 0) {
            setHistoryMessage("No activity yet. Make a deposit to get started!");
            return;
        }

        txHistoryList.innerHTML = "";

        allLogs.forEach(log => {
            const isDeposit = log.event === "Deposit";
            const amountEth = ethers.utils.formatEther(log.args.amount);
            const txHash = log.transactionHash;

            const li = document.createElement("li");
            li.className = `tx-item ${isDeposit ? "deposit" : "withdraw"}`;

            li.innerHTML = `
                <span class="tx-icon">${isDeposit ? "↓" : "↑"}</span>
                <span class="tx-main">
                    <span class="tx-type">${isDeposit ? "Deposit" : "Withdraw"}</span>
                    <span class="tx-amount">${parseFloat(amountEth).toFixed(4)} ETH</span>
                </span>
                <a href="https://sepolia.etherscan.io/tx/${txHash}" target="_blank" rel="noopener" class="tx-hash">
                    ${txHash.substring(0, 6)}...${txHash.substring(txHash.length - 4)}
                </a>
            `;
            txHistoryList.appendChild(li);
        });

    } catch (error) {
        const errorMsg = error.message || "Unknown RPC Error";
        console.error("Error loading history:", errorMsg);
        setHistoryMessage(`Couldn't load activity: ${errorMsg}`, true);
    }
}