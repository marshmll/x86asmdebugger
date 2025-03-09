import { CPU, EFLAGS_BITMASKS, MB } from "./CPU.js";

let timerId = 0;

const cpu = new CPU(1 * MB);
cpu.reset();

const codeEditor = document.querySelector(".code_editor");
const errorContainer = document.querySelector(".error_msg");
const errorCloseBtn = document.querySelector(".error_msg__btn");
const errorParagraph = document.querySelector(".error_msg__p");
const playButton = document.querySelector(".controls__button--play");
const stopButton = document.querySelector(".controls__button--stop");
const stepButton = document.querySelector(".controls__button--step");
const resetButton = document.querySelector(".controls__button--reset");
const tickLabel = document.querySelector(".tick_speed_label");
const tickInput = document.querySelector(".tick_speed");
const cpuTable = document.querySelector(".cpu_info__table");
const cpuRegistersTable = document.querySelector(".cpu_registers_table");
const registers = cpu.getAvailableRegisters();

const editor = CodeMirror.fromTextArea(document.getElementById("code"), {
  mode: "text/x-asm",
  lineNumbers: true,
  indentUnit: 4,
  autofocus: true,
});

restoreEditorValue();
updateCPUInfo();

codeEditor.addEventListener("input", (e) => {
  cpu.reset();
  clearHighlights();
  clearEditorValue();
  saveEditorValue();
  if (timerId !== 0) clearTimeout(timerId);
});

errorCloseBtn.addEventListener("click", (e) => {
  errorContainer.classList.add("hidden");
});

tickInput.addEventListener("change", (e) => {
  tickLabel.textContent = `Tick Speed: ${e.target.value} ms`;
});

playButton.addEventListener("click", (e) => {
  e.preventDefault();

  if (timerId != 0) return;

  errorContainer.classList.add("hidden");
  try {
    cpu.prepare(editor.getValue());
  } catch (e) {
    errorParagraph.textContent = e;
    errorContainer.classList.remove("hidden");
    return;
  }

  stopButton.style.opacity = "100%";
  e.currentTarget.style.opacity = "50%";
  timerId = setInterval(tick, tickInput.value);
});

stopButton.addEventListener("click", (e) => {
  e.preventDefault();

  if (timerId) clearTimeout(timerId);
  timerId = 0;
  playButton.style.opacity = "100%";
  e.currentTarget.style.opacity = "50%";
  updateCPUInfo();
});

stepButton.addEventListener("click", (e) => {
  e.preventDefault();

  errorContainer.classList.add("hidden");

  updateCPUInfo();

  try {
    cpu.prepare(editor.getValue());
    highlightLine(cpu.getCurrentLine());
    cpu.executeNextInstruction();
  } catch (e) {
    errorParagraph.textContent = e;
    errorContainer.classList.remove("hidden");
    return;
  }
});

resetButton.addEventListener("click", (e) => {
  e.preventDefault();

  cpu.reset();
  errorContainer.classList.add("hidden");

  clearHighlights();

  if (timerId != 0) clearInterval(timerId);
  timerId = 0;
  updateCPUInfo();
  playButton.style.opacity = "100%";
  stopButton.style.opacity = "100%";
});

function highlightLine(lineNumber) {
  clearHighlights();

  editor.addLineClass(lineNumber, "wrap", "highlighted-line");
}

function clearHighlights() {
  const lineCount = editor.lineCount();
  for (let i = 0; i < lineCount; i++) {
    editor.removeLineClass(i, "wrap", "highlighted-line");
  }
}

function saveEditorValue() {
  const value = editor.getValue();
  localStorage.setItem("editorValue", value);
}

function restoreEditorValue() {
  const savedValue = localStorage.getItem("editorValue");
  if (savedValue) {
    editor.setValue(savedValue);
  }
}

function clearEditorValue() {
  localStorage.removeItem("editorValue");
}

function updateCPUInfo() {
  let table_rows = registers
    .map((register) => {
      let twos_complement =
        cpu.getRegisterValue(register) < 0
          ? Math.pow(2, 32) - 1 + (cpu.getRegisterValue(register) + 1)
          : cpu.getRegisterValue(register);

      let unsigned =
        cpu.getRegisterValue(register) >= 0
          ? cpu.getRegisterValue(register)
          : twos_complement;

      let signed = cpu.getRegisterValue(register) >> 0;

      return `
    <tr>
        <td>${register}</td>
        <td>${unsigned}</td>
        <td>${signed}</td>
        <td>0x${twos_complement.toString(16).padStart(8, "0")}</td>
        <td>0b${twos_complement.toString(2).padStart(32, "0")}</td>
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

  let cpuRegisterRows = `
         <tr>
            <th title="Carry Flag">CF</th>
            <th title="Parity Flag">PF</th>
            <th title="Auxiliary Carry Flag">AF</th>
            <th title="Zero Flag">ZF</th>
            <th title="Sign Flag">SF</th>
            <th title="Overflow Flag">OF</th>
        </tr>
        <tr>
            <td>${cpu.isFlagSet(EFLAGS_BITMASKS["CARRY"])}</td>
            <td>${cpu.isFlagSet(EFLAGS_BITMASKS["PARITY"])}</td>
            <td>${cpu.isFlagSet(EFLAGS_BITMASKS["AUXILIARY_CARRY"])}</td>
            <td>${cpu.isFlagSet(EFLAGS_BITMASKS["ZERO"])}</td>
            <td>${cpu.isFlagSet(EFLAGS_BITMASKS["SIGN"])}</td>
            <td>${cpu.isFlagSet(EFLAGS_BITMASKS["OVERFLOW"])}</td>
        </tr>
  `;

  cpuRegistersTable.innerHTML = cpuRegisterRows;
}

function tick() {
  highlightLine(cpu.getCurrentLine());

  try {
    cpu.executeNextInstruction();
  } catch (e) {
    errorParagraph.textContent = e;
    errorContainer.classList.remove("hidden");
    clearTimeout(timerId);
    return;
  }

  updateCPUInfo();
}
