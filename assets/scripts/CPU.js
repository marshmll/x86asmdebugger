export const KB = 1024 * 1;
export const MB = 1024 * KB;

const REGISTERS_32 = [
  "eax",
  "ebx",
  "ecx",
  "edx",
  "esi",
  "edi",
  "ebp",
  "esp",
  "eip",
];
const REGISTERS_16 = ["ax", "bx", "cx", "dx", "si", "di", "bp", "sp"];
const REGISTERS_8_HIGH = ["ah", "bh", "ch", "dh"];
const REGISTERS_8_LOW = ["al", "bl", "cl", "dl"];

export const EFLAGS_BITMASKS = {
  OVERFLOW: 0x0800,
  DIRECTION: 0x4000,
  SIGN: 0x080,
  ZERO: 0x040,
  AUXILIARY_CARRY: 0x0010,
  PARITY: 0x0004,
  CARRY: 0x0001,
};

export class CPU {
  eax;
  ebx;
  ecx;
  edx;
  esi;
  edi;
  ebp;
  esp;
  eip;
  eflags;
  #stackSize;
  #code;
  #preparedTokens;
  #microcode;
  #stack;

  constructor(stack_size) {
    this.#stackSize = stack_size;
    this.#code = "";
    this.#preparedTokens = [];
    this.#microcode = {
      mov: this.#mov.bind(this),
      add: this.#add.bind(this),
      sub: this.#sub.bind(this),
      mul: this.#mul.bind(this),
      div: this.#div.bind(this),
      inc: this.#inc.bind(this),
      dec: this.#dec.bind(this),
      cmp: this.#cmp.bind(this),
      jmp: this.#jmp.bind(this),
      je: this.#je.bind(this),
      jz: this.#je.bind(this),
      jne: this.#jne.bind(this),
      jnz: this.#jne.bind(this),
      jg: this.#jg.bind(this),
      jns: this.#jg.bind(this),
      jl: this.#jl.bind(this),
      js: this.#jl.bind(this),
      and: this.#and.bind(this),
      or: this.#or.bind(this),
      xor: this.#xor.bind(this),
      not: this.#not.bind(this),
      shl: this.#shl.bind(this),
      shr: this.#shr.bind(this),
      push: this.#push.bind(this),
      pop: this.#pop.bind(this),
      call: this.#call.bind(this),
      ret: this.#ret.bind(this),
      hlt: this.#hlt.bind(this),
    };
    this.reset();
  }

  prepare(code) {
    this.#code = code;
    this.#tokenize(code);
  }

  executeNextInstruction() {
    if (this.#preparedTokens.length === 0) return;

    if (this.eip >= this.#preparedTokens.length) return;

    let instruction = this.#preparedTokens[this.eip];

    // Ignore labels
    if (instruction.endsWith(":")) {
      this.eip++;
      return;
    }

    // Strip inline comments (everything after ';')
    instruction = instruction.split(";")[0].trim();

    // Skip empty lines after stripping comments
    if (instruction.length === 0) {
      this.eip++;
      return;
    }

    // Get the instruction handler
    const handler = this.#microcode[instruction];

    if (handler) {
      let a = handler(this.#preparedTokens, this.eip);
      console.log("handler returned " + a);
      this.eip += a;
    } else {
      throw new SyntaxError(
        `Unknown or unsupported instruction: "${instruction}" at line ${
          this.getCurrentLine() + 1
        }`
      );
    }
  }

  reset() {
    this.eax = 0x00000000;
    this.ebx = 0x00000000;
    this.ecx = 0x00000000;
    this.edx = 0x00000000;
    this.esi = 0x00000000;
    this.edi = 0x00000000;
    this.ebp = this.#stackSize;
    this.esp = this.#stackSize;
    this.eflags = 0x00000000;
    this.eip = 0;
    this.#stack = [];
  }

  getRegisterValue(register) {
    return this[register] & (Math.pow(2, 32) - 1);
  }

  getAvailableRegisters() {
    return REGISTERS_32;
  }

  isFlagSet(flag_bitmask) {
    return (this.eflags & flag_bitmask) > 0 ? 1 : 0;
  }

  getCurrentLine() {
    const lines = this.#code.split("\n");
    let tokenCount = 0;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      // Skip empty lines
      if (line.length === 0) continue;

      // Strip inline comments (everything after ';')
      line = line.split(";")[0].trim();

      // Skip lines that are empty after stripping comments
      if (line.length === 0) continue;

      // Split the line into tokens
      const tokens = line.split(/\s+/).filter((token) => token.length > 0);

      // Check if the PC falls within this line's tokens
      if (this.eip >= tokenCount && this.eip < tokenCount + tokens.length) {
        return i; // Return the line number (0-based index)
      }

      // Update the token count
      tokenCount += tokens.length;
    }

    return -1; // No matching line found
  }

  #tokenize(code) {
    const lines = code.split("\n");
    this.#preparedTokens = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines and comments
      if (line.length === 0 || line.startsWith(";")) continue;

      // Handle labels
      if (line.endsWith(":")) {
        this.#preparedTokens.push(line);
        continue;
      }

      // Split the line into tokens
      const tokens = line.split(/\s+/).filter((token) => token.length > 0);
      const instruction = tokens[0].toLowerCase();
      const operands = tokens.slice(1).join(" ");

      // Validate instructions that require commas
      if (this.#requiresCommas(instruction)) {
        if (!operands.includes(",")) {
          throw new SyntaxError(
            `Missing comma in instruction: "${line}" at line ${
              i + 1
            }\nExpected format: "${instruction} dest, src"`
          );
        }

        const ops = operands.split(",").map((op) => op.trim());

        if (ops.length != 2) {
          throw new SyntaxError(
            `Invalid operands in instruction: "${line}" at line ${
              i + 1
            }\nExpected format: "${instruction} dest, src"`
          );
        }

        const [dest, src] = ops;

        if (!dest || !src) {
          throw new SyntaxError(
            `Invalid operands in instruction: "${line}" at line ${
              i + 1
            }\nExpected format: "${instruction} dest, src"`
          );
        }

        // Validate operand types
        if (!this.#isValidRegister(dest) && !this.#isImmediate(dest)) {
          throw new SyntaxError(
            `Invalid destination operand: "${dest}" at line ${i + 1}`
          );
        }
        if (!this.#isValidRegister(src) && !this.#isImmediate(src)) {
          throw new SyntaxError(
            `Invalid source operand: "${src}" at line ${i + 1}`
          );
        }

        this.#preparedTokens.push(instruction, dest, src);
      } else if (this.#isNoArgsInstruction(instruction)) {
        this.#preparedTokens.push(instruction);
      } else {
        // Handle instructions without commas

        if (!this.#microcode[tokens[0]]) {
          throw new SyntaxError(
            `Unknown or unsupported instruction: "${line}" at line ${i + 1}`
          );
        }

        if (tokens.length !== 2) {
          throw new SyntaxError(
            `Invalid number of operands in instruction: "${line}" at line ${
              i + 1
            }`
          );
        }

        const dest = tokens[1];
        if (
          !this.#isValidRegister(dest) &&
          !this.#isImmediate(dest) &&
          !code.includes(dest + ":")
        ) {
          throw new SyntaxError(
            `Invalid operand "${dest}" at line ${
              i + 1
            }. If it is a label, check if it exists and spelling.`
          );
        }

        this.#preparedTokens.push(instruction, dest);
      }
    }
  }

  #requiresCommas(instruction) {
    // List of instructions that require commas between operands
    const commaInstructions = [
      "mov",
      "add",
      "sub",
      "cmp",
      "and",
      "or",
      "xor",
      "shl",
      "shr",
    ];
    return commaInstructions.includes(instruction);
  }

  #getRegisterValue(reg) {
    if (REGISTERS_32.includes(reg)) {
      return this[reg];
    } else if (REGISTERS_16.includes(reg)) {
      return this[`e${reg}`] & 0xffff; // Lower 16 bits
    } else if (REGISTERS_8_HIGH.includes(reg)) {
      return (this[`e${reg[0]}x`] >> 8) & 0xff; // Upper 8 bits of 16-bit register
    } else if (REGISTERS_8_LOW.includes(reg)) {
      return this[`e${reg[0]}x`] & 0xff; // Lower 8 bits of 16-bit register
    } else {
      throw new SyntaxError(
        `Invalid register: "${reg}" at line ${this.getCurrentLine() + 1}`
      );
      return 0;
    }
  }

  #setRegisterValue(reg, value) {
    if (REGISTERS_32.includes(reg)) {
      this[reg] = value;
    } else if (REGISTERS_16.includes(reg)) {
      this[`e${reg}`] = (this[`e${reg}`] & 0xffff0000) | (value & 0xffff); // Set lower 16 bits
    } else if (REGISTERS_8_HIGH.includes(reg)) {
      this[`e${reg[0]}x`] =
        (this[`e${reg[0]}x`] & 0xffff00ff) | ((value & 0xff) << 8); // Set upper 8 bits
    } else if (REGISTERS_8_LOW.includes(reg)) {
      this[`e${reg[0]}x`] = (this[`e${reg[0]}x`] & 0xffffff00) | (value & 0xff); // Set lower 8 bits
    } else {
      throw new SyntaxError(
        `Invalid register: "${reg}" at line ${this.getCurrentLine() + 1}`
      );
    }
  }

  #mov(tokens, pc) {
    const dest = tokens[pc + 1];
    const src = tokens[pc + 2];

    // Move between registers
    if (this.#isValidRegister(dest) && this.#isValidRegister(src)) {
      const srcValue = this.#getRegisterValue(src);
      this.#setRegisterValue(dest, srcValue);
    }
    // Move immediate value to register
    else if (this.#isValidRegister(dest) && this.#isImmediate(src)) {
      const immediateValue = parseInt(src);
      this.#setRegisterValue(dest, immediateValue);
    } else {
      throw new SyntaxError(
        `Unsupported mov operation: "${dest}, ${src}" at line ${
          this.getCurrentLine() + 1
        }`
      );
    }

    return 3; // Move to the next instruction (3 tokens: mov, dest, src)
  }

  #add(tokens, pc) {
    const dest = tokens[pc + 1];
    const src = tokens[pc + 2];

    // Add two registers
    if (this.#isValidRegister(dest) && this.#isValidRegister(src)) {
      const srcValue = this.#getRegisterValue(src);
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue + srcValue);
    }
    // Add immediate value to register
    else if (this.#isValidRegister(dest) && this.#isImmediate(src)) {
      const immediateValue = parseInt(src);
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue + immediateValue);
    } else {
      throw new SyntaxError(
        `Unsupported add operation: "${dest}, ${src}" at line ${
          this.getCurrentLine() + 1
        }`
      );
    }

    this.eflags = 0;
    if (Math.abs(this.#getRegisterValue(dest) >= Math.pow(2, 32))) {
      this.eflags |= EFLAGS_BITMASKS["OVERFLOW"];
    }
    if (this.#getRegisterValue(dest) < 0) {
      this.eflags |= EFLAGS_BITMASKS["SIGN"];
    }
    if (this.#getRegisterValue(dest) == 0) {
      this.eflags |= EFLAGS_BITMASKS["ZERO"];
    }
    if ((this.#getRegisterValue(dest) & 0x01) == 0) {
      this.eflags |= EFLAGS_BITMASKS["PARITY"];
    }
    if (
      Math.abs(this.#getRegisterValue(dest) >= Math.pow(2, 32)) &&
      this.eflags & (EFLAGS_BITMASKS["SIGN"] == 0)
    ) {
      this.eflags |= EFLAGS_BITMASKS["CARRY"];
    }

    return 3; // Move to the next instruction (3 tokens: add, dest, src)
  }

  #sub(tokens, pc) {
    const dest = tokens[pc + 1];
    const src = tokens[pc + 2];
    let srcValue, destValue;

    // Subtract two registers
    if (this.#isValidRegister(dest) && this.#isValidRegister(src)) {
      srcValue = this.#getRegisterValue(src);
      destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue - srcValue);
    }
    // Subtract immediate value from register
    else if (this.#isValidRegister(dest) && this.#isImmediate(src)) {
      srcValue = parseInt(src);
      destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue - srcValue);
    } else {
      throw new SyntaxError(
        `Unsupported sub operation: "${dest}, ${src}" at line ${
          this.getCurrentLine() + 1
        }`
      );
    }

    this.eflags = 0;
    if (
      (srcValue >= 0 && destValue >= 0 && this.#getRegisterValue(dest) < 0) ||
      (srcValue < 0 && destValue < 0 && this.#getRegisterValue(dest) >= 0)
    ) {
      this.eflags |= EFLAGS_BITMASKS["OVERFLOW"];
    }
    if (this.#getRegisterValue(dest) < 0) {
      this.eflags |= EFLAGS_BITMASKS["SIGN"];
    }
    if (this.#getRegisterValue(dest) == 0) {
      this.eflags |= EFLAGS_BITMASKS["ZERO"];
    }
    if ((this.#getRegisterValue(dest) & 0x01) == 0) {
      this.eflags |= EFLAGS_BITMASKS["PARITY"];
    }
    if (srcValue > destValue) {
      this.eflags |= EFLAGS_BITMASKS["CARRY"];
    }

    return 3; // Move to the next instruction (3 tokens: sub, dest, src)
  }

  #mul(tokens, pc) {
    const dest = tokens[pc + 1];

    // Multiply register by another register
    if (this.#isValidRegister(dest)) {
      const destValue = this.#getRegisterValue(dest);
      this.eax *= destValue;
    } else {
      throw new SyntaxError(
        `Unsupported mul operation: "${dest}" at line ${
          this.getCurrentLine() + 1
        }`
      );
    }

    return 2; // Move to the next instruction (2 tokens: mul, dest)
  }

  #div(tokens, pc) {
    const dest = tokens[pc + 1];

    // Divide register by another register
    if (this.#isValidRegister(dest)) {
      const destValue = this.#getRegisterValue(dest);
      if (destValue === 0) {
        throw new SyntaxError(
          `Division by zero at line ${this.getCurrentLine() + 1}`
        );
      }
      this.edx = this.eax % destValue;
      this.eax = Math.floor(this.eax / destValue);
    } else {
      throw new SyntaxError(
        `Unsupported div operation: "${dest}" at line ${
          this.getCurrentLine() + 1
        }`
      );
    }

    return 2; // Move to the next instruction (2 tokens: div, dest)
  }

  #inc(tokens, pc) {
    const dest = tokens[pc + 1];

    // Increment register
    if (this.#isValidRegister(dest)) {
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue + 1);
    } else {
      throw new SyntaxError(
        `Unsupported inc operation: "${dest}" at line ${
          this.getCurrentLine() + 1
        }`
      );
    }

    return 2; // Move to the next instruction (2 tokens: inc, dest)
  }

  #dec(tokens, pc) {
    const dest = tokens[pc + 1];

    // Decrement register
    if (this.#isValidRegister(dest)) {
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue - 1);
    } else {
      throw new SyntaxError(
        `Unsupported dec operation: "${dest}" at line ${
          this.getCurrentLine() + 1
        }`
      );
    }

    return 2; // Move to the next instruction (2 tokens: dec, dest)
  }

  #cmp(tokens, pc) {
    const left = tokens[pc + 1];
    const right = tokens[pc + 2];

    let leftValue, rightValue;

    // Compare two registers
    if (this.#isValidRegister(left) && this.#isValidRegister(right)) {
      leftValue = this.#getRegisterValue(left);
      rightValue = this.#getRegisterValue(right);
    }
    // Compare register with immediate value
    else if (this.#isValidRegister(left) && this.#isImmediate(right)) {
      leftValue = this.#getRegisterValue(left);
      rightValue = parseInt(right);
    } else {
      throw new SyntaxError(
        `Unsupported cmp operation: "${left}, ${right}" at line ${
          this.getCurrentLine() + 1
        }`
      );
      return 3;
    }

    // Set EFLAGS based on comparison
    this.eflags = 0;
    if (
      (leftValue >= 0 && rightValue >= 0 && leftValue - rightValue < 0) ||
      (leftValue < 0 && rightValue < 0 && leftValue - rightValue >= 0)
    ) {
      this.eflags |= EFLAGS_BITMASKS["OVERFLOW"];
    }
    if (leftValue - rightValue < 0) {
      this.eflags |= EFLAGS_BITMASKS["SIGN"];
    }
    if (leftValue - rightValue == 0) {
      this.eflags |= EFLAGS_BITMASKS["ZERO"];
    }
    if (((leftValue - rightValue) & 0x01) == 0) {
      this.eflags |= EFLAGS_BITMASKS["PARITY"];
    }
    if (rightValue > leftValue) {
      this.eflags |= EFLAGS_BITMASKS["CARRY"];
    }

    return 3; // Move to the next instruction (3 tokens: cmp, left, right)
  }

  #jmp(tokens, pc) {
    const label = tokens[pc + 1];

    // Jump to label
    const labelIndex = this.#preparedTokens.indexOf(label + ":");

    console.log(labelIndex);

    if (labelIndex != -1) {
      console.log("jmp to label" + label);
      return labelIndex - this.eip + 1;
    } else {
      throw new SyntaxError(
        `Label not found: "${label}" referenced at line ${
          this.getCurrentLine() + 1
        }`
      );
    }
  }

  #je(tokens, pc) {
    if (this.eflags & EFLAGS_BITMASKS["ZERO"]) {
      // Zero flag
      return this.#jmp(tokens, pc);
    }
    return 2; // Move to the next instruction (2 tokens: je, label)
  }

  #jne(tokens, pc) {
    if (!(this.eflags & EFLAGS_BITMASKS["ZERO"])) {
      // Not zero flag
      return this.#jmp(tokens, pc);
    }
    return 2; // Move to the next instruction (2 tokens: jne, label)
  }

  #jg(tokens, pc) {
    if (this.eflags & EFLAGS_BITMASKS["OVERFLOW"]) {
      // Greater flag
      return this.#jmp(tokens, pc);
    }
    return 2; // Move to the next instruction (2 tokens: jg, label)
  }

  #jl(tokens, pc) {
    if (this.eflags & EFLAGS_BITMASKS["SIGN"]) {
      console.log("signal!");

      // Less flag
      return this.#jmp(tokens, pc);
    }
    return 2; // Move to the next instruction (2 tokens: jl, label)
  }

  #and(tokens, pc) {
    const dest = tokens[pc + 1];
    const src = tokens[pc + 2];

    // AND two registers
    if (this.#isValidRegister(dest) && this.#isValidRegister(src)) {
      const srcValue = this.#getRegisterValue(src);
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue & srcValue);
    }
    // AND register with immediate value
    else if (this.#isValidRegister(dest) && this.#isImmediate(src)) {
      const immediateValue = parseInt(src);
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue & immediateValue);
    } else {
      throw new SyntaxError(
        `Unsupported and operation: "${dest}, ${src}" at line ${
          this.getCurrentLine() + 1
        }`
      );
    }

    return 3; // Move to the next instruction (3 tokens: and, dest, src)
  }

  #or(tokens, pc) {
    const dest = tokens[pc + 1];
    const src = tokens[pc + 2];

    // OR two registers
    if (this.#isValidRegister(dest) && this.#isValidRegister(src)) {
      const srcValue = this.#getRegisterValue(src);
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue | srcValue);
    }
    // OR register with immediate value
    else if (this.#isValidRegister(dest) && this.#isImmediate(src)) {
      const immediateValue = parseInt(src);
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue | immediateValue);
    } else {
      throw new SyntaxError(
        `Unsupported or operation: "${dest}, ${src}" at line ${
          this.getCurrentLine() + 1
        }`
      );
    }

    return 3; // Move to the next instruction (3 tokens: or, dest, src)
  }

  #xor(tokens, pc) {
    const dest = tokens[pc + 1];
    const src = tokens[pc + 2];

    // XOR two registers
    if (this.#isValidRegister(dest) && this.#isValidRegister(src)) {
      const srcValue = this.#getRegisterValue(src);
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue ^ srcValue);
    }
    // XOR register with immediate value
    else if (this.#isValidRegister(dest) && this.#isImmediate(src)) {
      const immediateValue = parseInt(src);
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue ^ immediateValue);
    } else {
      throw new SyntaxError(
        `Unsupported xor operation: "${dest}, ${src}" at line ${
          this.getCurrentLine() + 1
        }`
      );
    }

    return 3; // Move to the next instruction (3 tokens: xor, dest, src)
  }

  #not(tokens, pc) {
    const dest = tokens[pc + 1];

    // NOT register
    if (this.#isValidRegister(dest)) {
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, ~destValue);
    } else {
      throw new SyntaxError(
        `Unsupported not operation: "${dest}" at line ${
          this.getCurrentLine() + 1
        }`
      );
    }

    return 2; // Move to the next instruction (2 tokens: not, dest)
  }

  #shl(tokens, pc) {
    const dest = tokens[pc + 1];
    const src = tokens[pc + 2];

    // Shift left register by another register
    if (this.#isValidRegister(dest) && this.#isValidRegister(src)) {
      const srcValue = this.#getRegisterValue(src);
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue << srcValue);
    }
    // Shift left register by immediate value
    else if (this.#isValidRegister(dest) && this.#isImmediate(src)) {
      const immediateValue = parseInt(src);
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue << immediateValue);
    } else {
      throw new SyntaxError(
        `Unsupported shl operation: "${dest}, ${src}" at line ${
          this.getCurrentLine() + 1
        }`
      );
    }

    return 3; // Move to the next instruction (3 tokens: shl, dest, src)
  }

  #shr(tokens, pc) {
    const dest = tokens[pc + 1];
    const src = tokens[pc + 2];

    // Shift right register by another register
    if (this.#isValidRegister(dest) && this.#isValidRegister(src)) {
      const srcValue = this.#getRegisterValue(src);
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue >> srcValue);
    }
    // Shift right register by immediate value
    else if (this.#isValidRegister(dest) && this.#isImmediate(src)) {
      const immediateValue = parseInt(src);
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue >> immediateValue);
    } else {
      throw new SyntaxError(
        `Unsupported shr operation: "${dest}, ${src}" at line ${
          this.getCurrentLine() + 1
        }`
      );
    }

    return 3; // Move to the next instruction (3 tokens: shr, dest, src)
  }

  #push(tokens, pc) {
    const src = tokens[pc + 1];

    // Push register onto stack
    if (this.#isValidRegister(src)) {
      this.#stack.push(this.#getRegisterValue(src));
      this.esp -= 4; // Update stack pointer

      if (this.esp > this.#stackSize) {
        throw new SyntaxError(
          `Stack overflow at line ${this.getCurrentLine() + 1}`
        );
      }
    }
    // Push immediate value onto stack
    else if (this.#isImmediate(src)) {
      this.#stack.push(parseInt(src));
      this.esp -= 4; // Update stack pointer

      if (this.esp > this.#stackSize) {
        throw new SyntaxError(
          `Stack overflow at line ${this.getCurrentLine() + 1}`
        );
      }
    } else {
      throw new SyntaxError(
        `Unsupported push operation: "${src}" at line ${
          this.getCurrentLine() + 1
        }`
      );
    }

    return 2; // Move to the next instruction (2 tokens: push, src)
  }

  #pop(tokens, pc) {
    const dest = tokens[pc + 1];

    // Pop value from stack into register
    if (this.#isValidRegister(dest)) {
      if (this.#stack.length > 0) {
        const value = this.#stack.pop();
        this.#setRegisterValue(dest, value);
        this.esp += 4; // Update stack pointer
      } else {
        throw new SyntaxError(
          `Stack underflow at line ${this.getCurrentLine() + 1}`
        );
      }
    } else {
      throw new SyntaxError(
        `Unsupported pop operation: "${dest}" at line ${
          this.getCurrentLine() + 1
        }`
      );
    }

    return 2; // Move to the next instruction (2 tokens: pop, dest)
  }

  #call(tokens, pc) {
    const label = tokens[pc + 1];

    // Push return address onto stack
    this.#stack.push(this.eip + 2);
    this.esp -= 4; // Update stack pointer

    // Jump to label
    return this.#jmp(tokens, pc);
  }

  #ret(tokens, pc) {
    // Pop return address from stack
    if (this.#stack.length > 0) {
      this.eip = this.#stack.pop();
      this.esp += 4; // Update stack pointer
      return 0; // Do not increment PC
    } else {
      throw new SyntaxError(
        `Stack underflow at line ${this.getCurrentLine() + 1}`
      );
    }
  }

  #hlt(tokens, pc) {
    return 0; // Halt the processor.
  }

  #isValidRegister(token) {
    return (
      (REGISTERS_32.includes(token) ||
        REGISTERS_16.includes(token) ||
        REGISTERS_8_HIGH.includes(token) ||
        REGISTERS_8_LOW.includes(token)) &&
      token != "eip"
    );
  }

  #isImmediate(token) {
    return !isNaN(parseInt(token));
  }

  #isNoArgsInstruction(instruction) {
    const noArgsInstructions = ["ret", "hlt"];
    return noArgsInstructions.includes(instruction);
  }
}
