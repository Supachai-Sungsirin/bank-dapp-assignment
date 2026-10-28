// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

contract Bank {
    mapping (address => uint) _balances;
    event Deposit(address indexed owner, uint amount);
    event Withdraw(address indexed owner, uint amount);

    function deposit() public payable {
        require(msg.value > 0, "Deposit money is zero");
        _balances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint amount) public {
        require(amount > 0 && amount <= _balances[msg.sender], "not enough money");
        
        // หักยอดเงินก่อนทำการโอน (ป้องกัน Reentrancy Attack)
        _balances[msg.sender] -= amount; 
        
        // ใช้ .call แทน .transfer ตามมาตรฐานใหม่
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");

        emit Withdraw(msg.sender, amount);
    }

    function checkBlance() public view returns (uint balance) {
        return _balances[msg.sender];
    }
}