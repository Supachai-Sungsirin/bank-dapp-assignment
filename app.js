let provider;          // สำหรับ MetaMask (Write)
let signer;            // สำหรับ MetaMask (Write)
let bankContract;      // สำหรับ MetaMask (Write - มี Signer)

let readProvider;      // สำหรับ Infura (Read)
let readContract;      // สำหรับ Infura (Read - ไม่มี Signer)

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

function showStatus(message, type = "success") {
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

chips.forEach(chip => {
    chip.addEventListener("click", () => setAmount(chip.dataset.amount));
});
amountInput.addEventListener("input", () => {
    chips.forEach(c => c.classList.toggle("active", c.dataset.amount === amountInput.value));
});

// 1. เชื่อมต่อ MetaMask (เตรียมไว้สำหรับการทำธุรกรรม)
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
            loadContractBtn.disabled = false;

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
        const abi = JSON.parse(abiString);

        // --- ตั้งค่าสำหรับสายเขียน (MetaMask) ---
        if (signer) {
             bankContract = new ethers.Contract(address, abi, signer);
        }

        // --- ตั้งค่าสำหรับสายอ่าน (Infura) ---
        const infuraUrl = "https://sepolia.infura.io/v3/d347ad81b1474f9b9c15dc3d6f2b78ff";
        readProvider = new ethers.providers.JsonRpcProvider(infuraUrl);
        readContract = new ethers.Contract(address, abi, readProvider);

        showStatus("Contract loaded!");
        loadContractBtn.textContent = "Contract loaded";
        loadContractBtn.disabled = true;
        contractAddressInput.disabled = true;
        contractAbiInput.disabled = true;
        stepContract.classList.add("done");

        enableContractInteraction();
        await getBalance(); 
        await loadTransactionHistory(); 
    } catch (error) {
        console.error(error);
        showStatus("Couldn't load the contract. Check that the address is correct and the ABI is valid JSON.", "error");
    }
});

// 3. ฟังก์ชันการทำงานของ Contract
async function getBalance() {
    // เปลี่ยนมาใช้ readContract (Infura) แทน
    if (!readContract || !userAddress) return; 
    try {
        showStatus("Fetching balance...", "info");
        // จำเป็นต้องส่ง address ผู้ใช้ไปด้วย เพราะฟังก์ชันใน contract อ้างอิง msg.sender (ใน Ethers.js แบบ read-only ต้อง override from)
        const balanceWei = await readContract.checkBlance({ from: userAddress }); 
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

    // ต้องเช็คก่อนว่าเชื่อม MetaMask หรือยัง สำหรับการ Write
    if(!bankContract) {
         showStatus("Please connect MetaMask and Load Contract first.", "error");
         return;
    }

    const buttons = [depositBtn, withdrawBtn];
    try {
        setBusy(buttons, true);
        showStatus("Confirm the deposit in MetaMask...", "info");
        const amountWei = ethers.utils.parseEther(amount);
        
        // ใช้ bankContract (MetaMask) เพื่อทำธุรกรรม
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

    // ต้องเช็คก่อนว่าเชื่อม MetaMask หรือยัง สำหรับการ Write
    if(!bankContract) {
         showStatus("Please connect MetaMask and Load Contract first.", "error");
         return;
    }

    const buttons = [depositBtn, withdrawBtn];
    try {
        setBusy(buttons, true);
        showStatus("Confirm the withdrawal in MetaMask...", "info");
        const amountWei = ethers.utils.parseEther(amount);
        
        // ใช้ bankContract (MetaMask) เพื่อทำธุรกรรม
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
    li.textContent = text; 
    txHistoryList.appendChild(li);
}

async function loadTransactionHistory() {
    // เปลี่ยนมาใช้ readContract (Infura)
    if (!readContract || !userAddress) return;

    try {
        setHistoryMessage("Loading activity...");

        if (!readContract.filters.Deposit || !readContract.filters.Withdraw) {
            throw new Error("ABI ของคุณไม่มีข้อมูล Event Deposit/Withdraw กรุณาใช้ JSON ABI จาก Remix");
        }

        const depositFilter = readContract.filters.Deposit(userAddress);
        const withdrawFilter = readContract.filters.Withdraw(userAddress);

        // ดึง block ล่าสุดผ่าน Infura
        const currentBlock = await readProvider.getBlockNumber();
        const fromBlock = currentBlock - 9000 > 0 ? currentBlock - 9000 : 0;

        // Query Logs ผ่าน Infura
        const depositLogs = await readContract.queryFilter(depositFilter, fromBlock, "latest");
        const withdrawLogs = await readContract.queryFilter(withdrawFilter, fromBlock, "latest");

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