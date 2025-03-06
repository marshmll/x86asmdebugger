import CPU from "./CPU.js";

const cpu = new CPU();
const input = document.querySelector(".code_editor__textarea");
const stepButton = document.querySelector(".controls__button--step");
const cpuTable = document.querySelector(".cpu_info__table");
const registers = cpu.getAvailableRegisters();

input.addEventListener("input", (e) => {
  cpu.reset();
  cpu.prepare(e.target.value);
});

stepButton.addEventListener("click", (e) => {
  e.preventDefault();

  cpu.executeNextInstruction();
  updateCPUInfo();

  console.log(cpu);
});

updateCPUInfo();

function updateCPUInfo() {
  let table_rows = registers
    .map((register) => {
        let signed = cpu.getRegisterValue(register) - Math.pow(2, 32); 

      return `
    <tr>
        <td>${register}</td>
        <td>${cpu.getRegisterValue(register)}</td>
        <td>${signed}</td>
        <td>0x${cpu.getRegisterValue(register).toString(16)}</td>
        <td>0b${cpu.getRegisterValue(register).toString(2)}</td>
    </tr>
    `;
    })
    .join("");

  cpuTable.innerHTML = "";
  cpuTable.innerHTML += ` 
    <tr>
        <th>Register</th>
        <th>Unsigned</th>
        <th>Signed</th>
        <th>Hexadecimal</th>
        <th>Binary</th>
    </tr>`;

  cpuTable.innerHTML += table_rows;
}
