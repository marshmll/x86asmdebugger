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

class CPU {
  eax;
  ebx;
  ecx;
  edx;
  esi;
  edi;
  ebp;
  eip;
  esp;
  eflags;
  #pc;
  #preparedTokens;
  #microcode;
  #stack;

  constructor() {
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
      jl: this.#jl.bind(this),
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
    };
    this.reset();
  }

  prepare(code) {
    this.#tokenize(code);
  }

  executeNextInstruction() {
    if (this.#preparedTokens.length === 0) return;

    if (this.#pc >= this.#preparedTokens.length) return;

    let instruction = this.#preparedTokens[this.#pc];

    // Ignore labels
    if (instruction.at(instruction.length - 1) == ":") {
      this.#pc++;
      return;
    }

    const handler = this.#microcode[instruction];

    if (handler) {
      this.#pc += handler(this.#preparedTokens, this.#pc);
    } else {
      alert(`Unknown instruction: ${instruction}`);
    }
  }

  reset() {
    this.eax = 0x00000000;
    this.ebx = 0x00000000;
    this.ecx = 0x00000000;
    this.edx = 0x00000000;
    this.esi = 0x00000000;
    this.edi = 0x00000000;
    this.ebp = 0x00000000;
    this.eip = 0x00000000;
    this.esp = 0x00000000;
    this.eflags = 0x00000000;
    this.#pc = 0x00000000;
    this.#stack = [];
  }

  getPC() {
    return this.#pc;
  }

  getRegisterValue(register) {
    return this[register];
  }

  getAvailableRegisters() {
    return REGISTERS_32;
  }

  #tokenize(code) {
    // Split code into tokens, handling commas and spaces
    this.#preparedTokens = code
      .split(/[\s,]+/)
      .map((token) =>
        token.at(token.length - 1) != ":" ? token.toLowerCase() : token
      )
      .filter((token) => token.length > 0);
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
      alert(`Invalid register: ${reg}`);
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
      alert(`Invalid register: ${reg}`);
    }
  }

  #mov(tokens, pc) {
    const dest = tokens[pc + 1];
    const src = tokens[pc + 2];

    // Move between registers
    if (this.#isRegister(dest) && this.#isRegister(src)) {
      const srcValue = this.#getRegisterValue(src);
      this.#setRegisterValue(dest, srcValue);
    }
    // Move immediate value to register
    else if (this.#isRegister(dest) && this.#isImmediate(src)) {
      const immediateValue = parseInt(src);
      this.#setRegisterValue(dest, immediateValue);
    } else {
      alert(`Unsupported mov operation: ${dest}, ${src}`);
    }

    return 3; // Move to the next instruction (3 tokens: mov, dest, src)
  }

  #add(tokens, pc) {
    const dest = tokens[pc + 1];
    const src = tokens[pc + 2];

    // Add two registers
    if (this.#isRegister(dest) && this.#isRegister(src)) {
      const srcValue = this.#getRegisterValue(src);
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue + srcValue);
    }
    // Add immediate value to register
    else if (this.#isRegister(dest) && this.#isImmediate(src)) {
      const immediateValue = parseInt(src);
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue + immediateValue);
    } else {
      alert(`Unsupported add operation: ${dest}, ${src}`);
    }

    return 3; // Move to the next instruction (3 tokens: add, dest, src)
  }

  #sub(tokens, pc) {
    const dest = tokens[pc + 1];
    const src = tokens[pc + 2];

    // Subtract two registers
    if (this.#isRegister(dest) && this.#isRegister(src)) {
      const srcValue = this.#getRegisterValue(src);
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue - srcValue);
    }
    // Subtract immediate value from register
    else if (this.#isRegister(dest) && this.#isImmediate(src)) {
      const immediateValue = parseInt(src);
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue - immediateValue);
    } else {
      alert(`Unsupported sub operation: ${dest}, ${src}`);
    }

    return 3; // Move to the next instruction (3 tokens: sub, dest, src)
  }

  #mul(tokens, pc) {
    const dest = tokens[pc + 1];

    // Multiply register by another register
    if (this.#isRegister(dest)) {
      const destValue = this.#getRegisterValue(dest);
      this.eax = this.eax * destValue;
    } else {
      alert(`Unsupported mul operation: ${dest}`);
    }

    return 2; // Move to the next instruction (2 tokens: mul, dest)
  }

  #div(tokens, pc) {
    const dest = tokens[pc + 1];

    // Divide register by another register
    if (this.#isRegister(dest)) {
      const destValue = this.#getRegisterValue(dest);
      if (destValue === 0) {
        alert(`Division by zero`);
        return 2;
      }
      this.eax = Math.floor(this.eax / destValue);
      this.edx = this.eax % destValue;
    } else {
      alert(`Unsupported div operation: ${dest}`);
    }

    return 2; // Move to the next instruction (2 tokens: div, dest)
  }

  #inc(tokens, pc) {
    const dest = tokens[pc + 1];

    // Increment register
    if (this.#isRegister(dest)) {
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue + 1);
    } else {
      alert(`Unsupported inc operation: ${dest}`);
    }

    return 2; // Move to the next instruction (2 tokens: inc, dest)
  }

  #dec(tokens, pc) {
    const dest = tokens[pc + 1];

    // Decrement register
    if (this.#isRegister(dest)) {
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue - 1);
    } else {
      alert(`Unsupported dec operation: ${dest}`);
    }

    return 2; // Move to the next instruction (2 tokens: dec, dest)
  }

  #cmp(tokens, pc) {
    const left = tokens[pc + 1];
    const right = tokens[pc + 2];

    let leftValue, rightValue;

    // Compare two registers
    if (this.#isRegister(left) && this.#isRegister(right)) {
      leftValue = this.#getRegisterValue(left);
      rightValue = this.#getRegisterValue(right);
    }
    // Compare register with immediate value
    else if (this.#isRegister(left) && this.#isImmediate(right)) {
      leftValue = this.#getRegisterValue(left);
      rightValue = parseInt(right);
    } else {
      alert(`Unsupported cmp operation: ${left}, ${right}`);
      return 3;
    }

    // Set EFLAGS based on comparison
    this.eflags = 0;
    if (leftValue === rightValue) {
      this.eflags |= 0x40; // Zero flag
    } else if (leftValue > rightValue) {
      this.eflags |= 0x800; // Greater flag
    } else if (leftValue < rightValue) {
      this.eflags |= 0x80; // Less flag
    }

    return 3; // Move to the next instruction (3 tokens: cmp, left, right)
  }

  #jmp(tokens, pc) {
    const label = tokens[pc + 1];

    // Jump to label
    const labelIndex = this.#preparedTokens.indexOf(label + ":");
    if (labelIndex !== -1) {
      this.#pc = labelIndex;
      return 0; // Do not increment PC
    } else {
      alert(`Label not found: ${label}`);
      return 2; // Move to the next instruction (2 tokens: jmp, label)
    }
  }

  #je(tokens, pc) {
    if (this.eflags & 0x40) {
      // Zero flag
      return this.#jmp(tokens, pc);
    }
    return 2; // Move to the next instruction (2 tokens: je, label)
  }

  #jne(tokens, pc) {
    if (!(this.eflags & 0x40)) {
      // Not zero flag
      return this.#jmp(tokens, pc);
    }
    return 2; // Move to the next instruction (2 tokens: jne, label)
  }

  #jg(tokens, pc) {
    if (this.eflags & 0x800) {
      // Greater flag
      return this.#jmp(tokens, pc);
    }
    return 2; // Move to the next instruction (2 tokens: jg, label)
  }

  #jl(tokens, pc) {
    if (this.eflags & 0x80) {
      // Less flag
      return this.#jmp(tokens, pc);
    }
    return 2; // Move to the next instruction (2 tokens: jl, label)
  }

  #and(tokens, pc) {
    const dest = tokens[pc + 1];
    const src = tokens[pc + 2];

    // AND two registers
    if (this.#isRegister(dest) && this.#isRegister(src)) {
      const srcValue = this.#getRegisterValue(src);
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue & srcValue);
    }
    // AND register with immediate value
    else if (this.#isRegister(dest) && this.#isImmediate(src)) {
      const immediateValue = parseInt(src);
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue & immediateValue);
    } else {
      alert(`Unsupported and operation: ${dest}, ${src}`);
    }

    return 3; // Move to the next instruction (3 tokens: and, dest, src)
  }

  #or(tokens, pc) {
    const dest = tokens[pc + 1];
    const src = tokens[pc + 2];

    // OR two registers
    if (this.#isRegister(dest) && this.#isRegister(src)) {
      const srcValue = this.#getRegisterValue(src);
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue | srcValue);
    }
    // OR register with immediate value
    else if (this.#isRegister(dest) && this.#isImmediate(src)) {
      const immediateValue = parseInt(src);
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue | immediateValue);
    } else {
      alert(`Unsupported or operation: ${dest}, ${src}`);
    }

    return 3; // Move to the next instruction (3 tokens: or, dest, src)
  }

  #xor(tokens, pc) {
    const dest = tokens[pc + 1];
    const src = tokens[pc + 2];

    // XOR two registers
    if (this.#isRegister(dest) && this.#isRegister(src)) {
      const srcValue = this.#getRegisterValue(src);
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue ^ srcValue);
    }
    // XOR register with immediate value
    else if (this.#isRegister(dest) && this.#isImmediate(src)) {
      const immediateValue = parseInt(src);
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue ^ immediateValue);
    } else {
      alert(`Unsupported xor operation: ${dest}, ${src}`);
    }

    return 3; // Move to the next instruction (3 tokens: xor, dest, src)
  }

  #not(tokens, pc) {
    const dest = tokens[pc + 1];

    // NOT register
    if (this.#isRegister(dest)) {
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, ~destValue);
    } else {
      alert(`Unsupported not operation: ${dest}`);
    }

    return 2; // Move to the next instruction (2 tokens: not, dest)
  }

  #shl(tokens, pc) {
    const dest = tokens[pc + 1];
    const src = tokens[pc + 2];

    // Shift left register by another register
    if (this.#isRegister(dest) && this.#isRegister(src)) {
      const srcValue = this.#getRegisterValue(src);
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue << srcValue);
    }
    // Shift left register by immediate value
    else if (this.#isRegister(dest) && this.#isImmediate(src)) {
      const immediateValue = parseInt(src);
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue << immediateValue);
    } else {
      alert(`Unsupported shl operation: ${dest}, ${src}`);
    }

    return 3; // Move to the next instruction (3 tokens: shl, dest, src)
  }

  #shr(tokens, pc) {
    const dest = tokens[pc + 1];
    const src = tokens[pc + 2];

    // Shift right register by another register
    if (this.#isRegister(dest) && this.#isRegister(src)) {
      const srcValue = this.#getRegisterValue(src);
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue >> srcValue);
    }
    // Shift right register by immediate value
    else if (this.#isRegister(dest) && this.#isImmediate(src)) {
      const immediateValue = parseInt(src);
      const destValue = this.#getRegisterValue(dest);
      this.#setRegisterValue(dest, destValue >> immediateValue);
    } else {
      alert(`Unsupported shr operation: ${dest}, ${src}`);
    }

    return 3; // Move to the next instruction (3 tokens: shr, dest, src)
  }

  #push(tokens, pc) {
    const src = tokens[pc + 1];

    // Push register onto stack
    if (this.#isRegister(src)) {
      this.#stack.push(this.#getRegisterValue(src));
      this.esp -= 4; // Update stack pointer
    }
    // Push immediate value onto stack
    else if (this.#isImmediate(src)) {
      this.#stack.push(parseInt(src));
      this.esp -= 4; // Update stack pointer
    } else {
      alert(`Unsupported push operation: ${src}`);
    }

    return 2; // Move to the next instruction (2 tokens: push, src)
  }

  #pop(tokens, pc) {
    const dest = tokens[pc + 1];

    // Pop value from stack into register
    if (this.#isRegister(dest)) {
      if (this.#stack.length > 0) {
        const value = this.#stack.pop();
        this.#setRegisterValue(dest, value);
        this.esp += 4; // Update stack pointer
      } else {
        alert(`Stack underflow`);
      }
    } else {
      alert(`Unsupported pop operation: ${dest}`);
    }

    return 2; // Move to the next instruction (2 tokens: pop, dest)
  }

  #call(tokens, pc) {
    const label = tokens[pc + 1];

    // Push return address onto stack
    this.#stack.push(this.#pc + 2);
    this.esp -= 4; // Update stack pointer

    // Jump to label
    return this.#jmp(tokens, pc);
  }

  #ret(tokens, pc) {
    // Pop return address from stack
    if (this.#stack.length > 0) {
      this.#pc = this.#stack.pop();
      this.esp += 4; // Update stack pointer
      return 0; // Do not increment PC
    } else {
      alert(`Stack underflow`);
      return 1; // Move to the next instruction (1 token: ret)
    }
  }

  #isRegister(token) {
    return (
      REGISTERS_32.includes(token) ||
      REGISTERS_16.includes(token) ||
      REGISTERS_8_HIGH.includes(token) ||
      REGISTERS_8_LOW.includes(token)
    );
  }

  #isImmediate(token) {
    return !isNaN(parseInt(token));
  }
}

export default CPU;
