// Behavioral 6502-like CPU Emulator
// Instruction-accurate implementation for high-speed execution
// Extended instruction set supporting full monitor/BIOS programs

export class CPU6502 {
  // Registers (8-bit)
  a = 0;
  x = 0;
  y = 0;
  sp = 0xff;

  // Program counter (16-bit)
  pc = 0;

  // Flags
  carry = false;
  zero = false;
  negative = false;
  overflow = false;
  interruptDisable = true; // I flag - starts disabled after reset

  // Interrupt state
  irqPending = false;
  nmiPending = false;
  nmiEdge = false; // NMI is edge-triggered

  // State
  halted = false;
  cycles = 0;

  // Memory (64KB)
  memory: Uint8Array;

  constructor(memory?: Uint8Array) {
    this.memory = memory ?? new Uint8Array(65536);
  }

  /**
   * Reset the CPU - reads reset vector from $FFFC/$FFFD
   */
  reset(): void {
    this.a = 0;
    this.x = 0;
    this.y = 0;
    this.sp = 0xff;
    this.carry = false;
    this.zero = false;
    this.negative = false;
    this.overflow = false;
    this.interruptDisable = true; // I flag set on reset
    this.irqPending = false;
    this.nmiPending = false;
    this.nmiEdge = false;
    this.halted = false;
    this.cycles = 0;

    // Read reset vector
    this.pc = this.memory[0xfffc] | (this.memory[0xfffd] << 8);
  }

  /**
   * Trigger an IRQ (maskable interrupt)
   */
  triggerIrq(): void {
    this.irqPending = true;
  }

  /**
   * Clear IRQ
   */
  clearIrq(): void {
    this.irqPending = false;
  }

  /**
   * Trigger an NMI (non-maskable interrupt)
   */
  triggerNmi(): void {
    if (!this.nmiEdge) {
      this.nmiPending = true;
      this.nmiEdge = true;
    }
  }

  /**
   * Clear NMI edge detector (call when NMI line goes high)
   */
  clearNmi(): void {
    this.nmiEdge = false;
  }

  /**
   * Execute one instruction
   * @returns Number of cycles consumed
   */
  step(): number {
    if (this.halted) return 0;

    // Check for NMI (highest priority, non-maskable)
    if (this.nmiPending) {
      this.nmiPending = false;
      return this.handleNmi();
    }

    // Check for IRQ (maskable)
    if (this.irqPending && !this.interruptDisable) {
      return this.handleIrq();
    }

    const opcode = this.memory[this.pc++];
    this.pc &= 0xffff;

    const cycles = this.execute(opcode);
    this.cycles += cycles;
    return cycles;
  }

  private handleNmi(): number {
    this.push((this.pc >> 8) & 0xff);
    this.push(this.pc & 0xff);
    this.push(this.getStatusByte() & ~0x10); // Clear B flag for hardware interrupt
    this.interruptDisable = true;
    this.pc = this.memory[0xfffa] | (this.memory[0xfffb] << 8);
    const cycles = 7;
    this.cycles += cycles;
    return cycles;
  }

  private handleIrq(): number {
    this.push((this.pc >> 8) & 0xff);
    this.push(this.pc & 0xff);
    this.push(this.getStatusByte() & ~0x10); // Clear B flag for hardware interrupt
    this.interruptDisable = true;
    this.pc = this.memory[0xfffe] | (this.memory[0xffff] << 8);
    const cycles = 7;
    this.cycles += cycles;
    return cycles;
  }

  /**
   * Run multiple instructions
   * @param count Number of instructions to execute
   * @returns Total cycles consumed
   */
  run(count: number): number {
    let totalCycles = 0;
    for (let i = 0; i < count && !this.halted; i++) {
      totalCycles += this.step();
    }
    return totalCycles;
  }

  /**
   * Run until halted or cycle limit reached
   */
  runUntilHalt(maxCycles = 1000000): number {
    let totalCycles = 0;
    while (!this.halted && totalCycles < maxCycles) {
      totalCycles += this.step();
    }
    return totalCycles;
  }

  private execute(opcode: number): number {
    switch (opcode) {
      // ============ Load Instructions ============
      // LDA
      case 0xa9: return this.lda_imm();
      case 0xa5: return this.lda_zp();
      case 0xb5: return this.lda_zpx();
      case 0xad: return this.lda_abs();
      case 0xbd: return this.lda_absx();
      case 0xb9: return this.lda_absy();
      case 0xa1: return this.lda_indx();
      case 0xb1: return this.lda_indy();
      // LDX
      case 0xa2: return this.ldx_imm();
      case 0xa6: return this.ldx_zp();
      case 0xb6: return this.ldx_zpy();
      case 0xae: return this.ldx_abs();
      case 0xbe: return this.ldx_absy();
      // LDY
      case 0xa0: return this.ldy_imm();
      case 0xa4: return this.ldy_zp();
      case 0xb4: return this.ldy_zpx();
      case 0xac: return this.ldy_abs();
      case 0xbc: return this.ldy_absx();

      // ============ Store Instructions ============
      // STA
      case 0x85: return this.sta_zp();
      case 0x95: return this.sta_zpx();
      case 0x8d: return this.sta_abs();
      case 0x9d: return this.sta_absx();
      case 0x99: return this.sta_absy();
      case 0x81: return this.sta_indx();
      case 0x91: return this.sta_indy();
      // STX
      case 0x86: return this.stx_zp();
      case 0x96: return this.stx_zpy();
      case 0x8e: return this.stx_abs();
      // STY
      case 0x84: return this.sty_zp();
      case 0x94: return this.sty_zpx();
      case 0x8c: return this.sty_abs();

      // ============ Arithmetic ============
      // ADC
      case 0x69: return this.adc_imm();
      case 0x65: return this.adc_zp();
      case 0x75: return this.adc_zpx();
      case 0x6d: return this.adc_abs();
      case 0x7d: return this.adc_absx();
      case 0x79: return this.adc_absy();
      case 0x61: return this.adc_indx();
      case 0x71: return this.adc_indy();
      // SBC
      case 0xe9: return this.sbc_imm();
      case 0xe5: return this.sbc_zp();
      case 0xf5: return this.sbc_zpx();
      case 0xed: return this.sbc_abs();
      case 0xfd: return this.sbc_absx();
      case 0xf9: return this.sbc_absy();
      case 0xe1: return this.sbc_indx();
      case 0xf1: return this.sbc_indy();
      // CMP
      case 0xc9: return this.cmp_imm();
      case 0xc5: return this.cmp_zp();
      case 0xd5: return this.cmp_zpx();
      case 0xcd: return this.cmp_abs();
      case 0xdd: return this.cmp_absx();
      case 0xd9: return this.cmp_absy();
      case 0xc1: return this.cmp_indx();
      case 0xd1: return this.cmp_indy();
      // CPX
      case 0xe0: return this.cpx_imm();
      case 0xe4: return this.cpx_zp();
      case 0xec: return this.cpx_abs();
      // CPY
      case 0xc0: return this.cpy_imm();
      case 0xc4: return this.cpy_zp();
      case 0xcc: return this.cpy_abs();

      // ============ Logic ============
      // AND
      case 0x29: return this.and_imm();
      case 0x25: return this.and_zp();
      case 0x35: return this.and_zpx();
      case 0x2d: return this.and_abs();
      case 0x3d: return this.and_absx();
      case 0x39: return this.and_absy();
      case 0x21: return this.and_indx();
      case 0x31: return this.and_indy();
      // ORA
      case 0x09: return this.ora_imm();
      case 0x05: return this.ora_zp();
      case 0x15: return this.ora_zpx();
      case 0x0d: return this.ora_abs();
      case 0x1d: return this.ora_absx();
      case 0x19: return this.ora_absy();
      case 0x01: return this.ora_indx();
      case 0x11: return this.ora_indy();
      // EOR
      case 0x49: return this.eor_imm();
      case 0x45: return this.eor_zp();
      case 0x55: return this.eor_zpx();
      case 0x4d: return this.eor_abs();
      case 0x5d: return this.eor_absx();
      case 0x59: return this.eor_absy();
      case 0x41: return this.eor_indx();
      case 0x51: return this.eor_indy();

      // ============ Shift/Rotate ============
      // ASL
      case 0x0a: return this.asl_acc();
      case 0x06: return this.asl_zp();
      case 0x16: return this.asl_zpx();
      case 0x0e: return this.asl_abs();
      case 0x1e: return this.asl_absx();
      // LSR
      case 0x4a: return this.lsr_acc();
      case 0x46: return this.lsr_zp();
      case 0x56: return this.lsr_zpx();
      case 0x4e: return this.lsr_abs();
      case 0x5e: return this.lsr_absx();
      // ROL
      case 0x2a: return this.rol_acc();
      case 0x26: return this.rol_zp();
      case 0x36: return this.rol_zpx();
      case 0x2e: return this.rol_abs();
      case 0x3e: return this.rol_absx();
      // ROR
      case 0x6a: return this.ror_acc();
      case 0x66: return this.ror_zp();
      case 0x76: return this.ror_zpx();
      case 0x6e: return this.ror_abs();
      case 0x7e: return this.ror_absx();

      // ============ Inc/Dec Memory ============
      case 0xe6: return this.inc_zp();
      case 0xf6: return this.inc_zpx();
      case 0xee: return this.inc_abs();
      case 0xfe: return this.inc_absx();
      case 0xc6: return this.dec_zp();
      case 0xd6: return this.dec_zpx();
      case 0xce: return this.dec_abs();
      case 0xde: return this.dec_absx();

      // ============ Jumps ============
      case 0x4c: return this.jmp_abs();
      case 0x6c: return this.jmp_ind();
      case 0x20: return this.jsr_abs();
      case 0x60: return this.rts();

      // ============ Branches ============
      case 0x10: return this.bpl();
      case 0x30: return this.bmi();
      case 0x50: return this.bvc();
      case 0x70: return this.bvs();
      case 0x90: return this.bcc();
      case 0xb0: return this.bcs();
      case 0xd0: return this.bne();
      case 0xf0: return this.beq();

      // ============ Register Operations ============
      case 0xe8: return this.inx();
      case 0xca: return this.dex();
      case 0xc8: return this.iny();
      case 0x88: return this.dey();
      case 0xaa: return this.tax();
      case 0xa8: return this.tay();
      case 0x8a: return this.txa();
      case 0x98: return this.tya();
      case 0x9a: return this.txs();
      case 0xba: return this.tsx();

      // ============ Stack ============
      case 0x48: return this.pha();
      case 0x68: return this.pla();
      case 0x08: return this.php();
      case 0x28: return this.plp();

      // ============ Flags ============
      case 0x18: return this.clc();
      case 0x38: return this.sec();
      case 0x58: return this.cli();
      case 0x78: return this.sei();
      case 0xb8: return this.clv();
      case 0xd8: return this.cld();
      case 0xf8: return this.sed();

      // ============ Misc ============
      case 0xea: return this.nop();
      case 0x00: return this.brk();
      case 0x40: return this.rti();

      // ============ BIT test ============
      case 0x24: return this.bit_zp();
      case 0x2c: return this.bit_abs();

      // ============ Control (custom) ============
      case 0x02: return this.hlt();

      default:
        throw new Error(`Unknown opcode: 0x${opcode.toString(16).padStart(2, '0')} at PC=0x${(this.pc - 1).toString(16).padStart(4, '0')}`);
    }
  }

  // ============ Addressing Mode Helpers ============

  private readByte(): number {
    const value = this.memory[this.pc++];
    this.pc &= 0xffff;
    return value;
  }

  private readWord(): number {
    const lo = this.memory[this.pc++];
    const hi = this.memory[this.pc++];
    this.pc &= 0xffff;
    return lo | (hi << 8);
  }

  private addrZp(): number {
    return this.readByte();
  }

  private addrZpX(): number {
    return (this.readByte() + this.x) & 0xff;
  }

  private addrZpY(): number {
    return (this.readByte() + this.y) & 0xff;
  }

  private addrAbs(): number {
    return this.readWord();
  }

  private addrAbsX(): number {
    return (this.readWord() + this.x) & 0xffff;
  }

  private addrAbsY(): number {
    return (this.readWord() + this.y) & 0xffff;
  }

  private addrIndX(): number {
    const zp = (this.readByte() + this.x) & 0xff;
    return this.memory[zp] | (this.memory[(zp + 1) & 0xff] << 8);
  }

  private addrIndY(): number {
    const zp = this.readByte();
    const base = this.memory[zp] | (this.memory[(zp + 1) & 0xff] << 8);
    return (base + this.y) & 0xffff;
  }

  // ============ Load Instructions ============

  private lda_imm(): number { this.a = this.readByte(); this.setNZ(this.a); return 2; }
  private lda_zp(): number { this.a = this.memory[this.addrZp()]; this.setNZ(this.a); return 3; }
  private lda_zpx(): number { this.a = this.memory[this.addrZpX()]; this.setNZ(this.a); return 4; }
  private lda_abs(): number { this.a = this.memory[this.addrAbs()]; this.setNZ(this.a); return 4; }
  private lda_absx(): number { this.a = this.memory[this.addrAbsX()]; this.setNZ(this.a); return 4; }
  private lda_absy(): number { this.a = this.memory[this.addrAbsY()]; this.setNZ(this.a); return 4; }
  private lda_indx(): number { this.a = this.memory[this.addrIndX()]; this.setNZ(this.a); return 6; }
  private lda_indy(): number { this.a = this.memory[this.addrIndY()]; this.setNZ(this.a); return 5; }

  private ldx_imm(): number { this.x = this.readByte(); this.setNZ(this.x); return 2; }
  private ldx_zp(): number { this.x = this.memory[this.addrZp()]; this.setNZ(this.x); return 3; }
  private ldx_zpy(): number { this.x = this.memory[this.addrZpY()]; this.setNZ(this.x); return 4; }
  private ldx_abs(): number { this.x = this.memory[this.addrAbs()]; this.setNZ(this.x); return 4; }
  private ldx_absy(): number { this.x = this.memory[this.addrAbsY()]; this.setNZ(this.x); return 4; }

  private ldy_imm(): number { this.y = this.readByte(); this.setNZ(this.y); return 2; }
  private ldy_zp(): number { this.y = this.memory[this.addrZp()]; this.setNZ(this.y); return 3; }
  private ldy_zpx(): number { this.y = this.memory[this.addrZpX()]; this.setNZ(this.y); return 4; }
  private ldy_abs(): number { this.y = this.memory[this.addrAbs()]; this.setNZ(this.y); return 4; }
  private ldy_absx(): number { this.y = this.memory[this.addrAbsX()]; this.setNZ(this.y); return 4; }

  // ============ Store Instructions ============

  private sta_zp(): number { this.memory[this.addrZp()] = this.a; return 3; }
  private sta_zpx(): number { this.memory[this.addrZpX()] = this.a; return 4; }
  private sta_abs(): number { this.memory[this.addrAbs()] = this.a; return 4; }
  private sta_absx(): number { this.memory[this.addrAbsX()] = this.a; return 5; }
  private sta_absy(): number { this.memory[this.addrAbsY()] = this.a; return 5; }
  private sta_indx(): number { this.memory[this.addrIndX()] = this.a; return 6; }
  private sta_indy(): number { this.memory[this.addrIndY()] = this.a; return 6; }

  private stx_zp(): number { this.memory[this.addrZp()] = this.x; return 3; }
  private stx_zpy(): number { this.memory[this.addrZpY()] = this.x; return 4; }
  private stx_abs(): number { this.memory[this.addrAbs()] = this.x; return 4; }

  private sty_zp(): number { this.memory[this.addrZp()] = this.y; return 3; }
  private sty_zpx(): number { this.memory[this.addrZpX()] = this.y; return 4; }
  private sty_abs(): number { this.memory[this.addrAbs()] = this.y; return 4; }

  // ============ Arithmetic ============

  private adc(operand: number): void {
    const carryIn = this.carry ? 1 : 0;
    const sum = this.a + operand + carryIn;
    const signA = this.a & 0x80;
    const signB = operand & 0x80;
    const signResult = sum & 0x80;
    this.overflow = !!(~(signA ^ signB) & (signA ^ signResult) & 0x80);
    this.carry = sum > 0xff;
    this.a = sum & 0xff;
    this.setNZ(this.a);
  }

  private adc_imm(): number { this.adc(this.readByte()); return 2; }
  private adc_zp(): number { this.adc(this.memory[this.addrZp()]); return 3; }
  private adc_zpx(): number { this.adc(this.memory[this.addrZpX()]); return 4; }
  private adc_abs(): number { this.adc(this.memory[this.addrAbs()]); return 4; }
  private adc_absx(): number { this.adc(this.memory[this.addrAbsX()]); return 4; }
  private adc_absy(): number { this.adc(this.memory[this.addrAbsY()]); return 4; }
  private adc_indx(): number { this.adc(this.memory[this.addrIndX()]); return 6; }
  private adc_indy(): number { this.adc(this.memory[this.addrIndY()]); return 5; }

  private sbc(operand: number): void {
    const carryIn = this.carry ? 1 : 0;
    const invertedOp = operand ^ 0xff;
    const sum = this.a + invertedOp + carryIn;
    const signA = this.a & 0x80;
    const signB = invertedOp & 0x80;
    const signResult = sum & 0x80;
    this.overflow = !!(~(signA ^ signB) & (signA ^ signResult) & 0x80);
    this.carry = sum > 0xff;
    this.a = sum & 0xff;
    this.setNZ(this.a);
  }

  private sbc_imm(): number { this.sbc(this.readByte()); return 2; }
  private sbc_zp(): number { this.sbc(this.memory[this.addrZp()]); return 3; }
  private sbc_zpx(): number { this.sbc(this.memory[this.addrZpX()]); return 4; }
  private sbc_abs(): number { this.sbc(this.memory[this.addrAbs()]); return 4; }
  private sbc_absx(): number { this.sbc(this.memory[this.addrAbsX()]); return 4; }
  private sbc_absy(): number { this.sbc(this.memory[this.addrAbsY()]); return 4; }
  private sbc_indx(): number { this.sbc(this.memory[this.addrIndX()]); return 6; }
  private sbc_indy(): number { this.sbc(this.memory[this.addrIndY()]); return 5; }

  private cmp(operand: number): void {
    const result = this.a - operand;
    this.carry = this.a >= operand;
    this.zero = (result & 0xff) === 0;
    this.negative = !!(result & 0x80);
  }

  private cmp_imm(): number { this.cmp(this.readByte()); return 2; }
  private cmp_zp(): number { this.cmp(this.memory[this.addrZp()]); return 3; }
  private cmp_zpx(): number { this.cmp(this.memory[this.addrZpX()]); return 4; }
  private cmp_abs(): number { this.cmp(this.memory[this.addrAbs()]); return 4; }
  private cmp_absx(): number { this.cmp(this.memory[this.addrAbsX()]); return 4; }
  private cmp_absy(): number { this.cmp(this.memory[this.addrAbsY()]); return 4; }
  private cmp_indx(): number { this.cmp(this.memory[this.addrIndX()]); return 6; }
  private cmp_indy(): number { this.cmp(this.memory[this.addrIndY()]); return 5; }

  private cpx(operand: number): void {
    const result = this.x - operand;
    this.carry = this.x >= operand;
    this.zero = (result & 0xff) === 0;
    this.negative = !!(result & 0x80);
  }

  private cpx_imm(): number { this.cpx(this.readByte()); return 2; }
  private cpx_zp(): number { this.cpx(this.memory[this.addrZp()]); return 3; }
  private cpx_abs(): number { this.cpx(this.memory[this.addrAbs()]); return 4; }

  private cpy(operand: number): void {
    const result = this.y - operand;
    this.carry = this.y >= operand;
    this.zero = (result & 0xff) === 0;
    this.negative = !!(result & 0x80);
  }

  private cpy_imm(): number { this.cpy(this.readByte()); return 2; }
  private cpy_zp(): number { this.cpy(this.memory[this.addrZp()]); return 3; }
  private cpy_abs(): number { this.cpy(this.memory[this.addrAbs()]); return 4; }

  // ============ Logic ============

  private and_imm(): number { this.a &= this.readByte(); this.setNZ(this.a); return 2; }
  private and_zp(): number { this.a &= this.memory[this.addrZp()]; this.setNZ(this.a); return 3; }
  private and_zpx(): number { this.a &= this.memory[this.addrZpX()]; this.setNZ(this.a); return 4; }
  private and_abs(): number { this.a &= this.memory[this.addrAbs()]; this.setNZ(this.a); return 4; }
  private and_absx(): number { this.a &= this.memory[this.addrAbsX()]; this.setNZ(this.a); return 4; }
  private and_absy(): number { this.a &= this.memory[this.addrAbsY()]; this.setNZ(this.a); return 4; }
  private and_indx(): number { this.a &= this.memory[this.addrIndX()]; this.setNZ(this.a); return 6; }
  private and_indy(): number { this.a &= this.memory[this.addrIndY()]; this.setNZ(this.a); return 5; }

  private ora_imm(): number { this.a |= this.readByte(); this.setNZ(this.a); return 2; }
  private ora_zp(): number { this.a |= this.memory[this.addrZp()]; this.setNZ(this.a); return 3; }
  private ora_zpx(): number { this.a |= this.memory[this.addrZpX()]; this.setNZ(this.a); return 4; }
  private ora_abs(): number { this.a |= this.memory[this.addrAbs()]; this.setNZ(this.a); return 4; }
  private ora_absx(): number { this.a |= this.memory[this.addrAbsX()]; this.setNZ(this.a); return 4; }
  private ora_absy(): number { this.a |= this.memory[this.addrAbsY()]; this.setNZ(this.a); return 4; }
  private ora_indx(): number { this.a |= this.memory[this.addrIndX()]; this.setNZ(this.a); return 6; }
  private ora_indy(): number { this.a |= this.memory[this.addrIndY()]; this.setNZ(this.a); return 5; }

  private eor_imm(): number { this.a ^= this.readByte(); this.setNZ(this.a); return 2; }
  private eor_zp(): number { this.a ^= this.memory[this.addrZp()]; this.setNZ(this.a); return 3; }
  private eor_zpx(): number { this.a ^= this.memory[this.addrZpX()]; this.setNZ(this.a); return 4; }
  private eor_abs(): number { this.a ^= this.memory[this.addrAbs()]; this.setNZ(this.a); return 4; }
  private eor_absx(): number { this.a ^= this.memory[this.addrAbsX()]; this.setNZ(this.a); return 4; }
  private eor_absy(): number { this.a ^= this.memory[this.addrAbsY()]; this.setNZ(this.a); return 4; }
  private eor_indx(): number { this.a ^= this.memory[this.addrIndX()]; this.setNZ(this.a); return 6; }
  private eor_indy(): number { this.a ^= this.memory[this.addrIndY()]; this.setNZ(this.a); return 5; }

  // ============ Shift/Rotate ============

  private asl(value: number): number {
    this.carry = !!(value & 0x80);
    const result = (value << 1) & 0xff;
    this.setNZ(result);
    return result;
  }

  private asl_acc(): number { this.a = this.asl(this.a); return 2; }
  private asl_zp(): number { const addr = this.addrZp(); this.memory[addr] = this.asl(this.memory[addr]); return 5; }
  private asl_zpx(): number { const addr = this.addrZpX(); this.memory[addr] = this.asl(this.memory[addr]); return 6; }
  private asl_abs(): number { const addr = this.addrAbs(); this.memory[addr] = this.asl(this.memory[addr]); return 6; }
  private asl_absx(): number { const addr = this.addrAbsX(); this.memory[addr] = this.asl(this.memory[addr]); return 7; }

  private lsr(value: number): number {
    this.carry = !!(value & 0x01);
    const result = value >> 1;
    this.setNZ(result);
    return result;
  }

  private lsr_acc(): number { this.a = this.lsr(this.a); return 2; }
  private lsr_zp(): number { const addr = this.addrZp(); this.memory[addr] = this.lsr(this.memory[addr]); return 5; }
  private lsr_zpx(): number { const addr = this.addrZpX(); this.memory[addr] = this.lsr(this.memory[addr]); return 6; }
  private lsr_abs(): number { const addr = this.addrAbs(); this.memory[addr] = this.lsr(this.memory[addr]); return 6; }
  private lsr_absx(): number { const addr = this.addrAbsX(); this.memory[addr] = this.lsr(this.memory[addr]); return 7; }

  private rol(value: number): number {
    const carryIn = this.carry ? 1 : 0;
    this.carry = !!(value & 0x80);
    const result = ((value << 1) | carryIn) & 0xff;
    this.setNZ(result);
    return result;
  }

  private rol_acc(): number { this.a = this.rol(this.a); return 2; }
  private rol_zp(): number { const addr = this.addrZp(); this.memory[addr] = this.rol(this.memory[addr]); return 5; }
  private rol_zpx(): number { const addr = this.addrZpX(); this.memory[addr] = this.rol(this.memory[addr]); return 6; }
  private rol_abs(): number { const addr = this.addrAbs(); this.memory[addr] = this.rol(this.memory[addr]); return 6; }
  private rol_absx(): number { const addr = this.addrAbsX(); this.memory[addr] = this.rol(this.memory[addr]); return 7; }

  private ror(value: number): number {
    const carryIn = this.carry ? 0x80 : 0;
    this.carry = !!(value & 0x01);
    const result = (value >> 1) | carryIn;
    this.setNZ(result);
    return result;
  }

  private ror_acc(): number { this.a = this.ror(this.a); return 2; }
  private ror_zp(): number { const addr = this.addrZp(); this.memory[addr] = this.ror(this.memory[addr]); return 5; }
  private ror_zpx(): number { const addr = this.addrZpX(); this.memory[addr] = this.ror(this.memory[addr]); return 6; }
  private ror_abs(): number { const addr = this.addrAbs(); this.memory[addr] = this.ror(this.memory[addr]); return 6; }
  private ror_absx(): number { const addr = this.addrAbsX(); this.memory[addr] = this.ror(this.memory[addr]); return 7; }

  // ============ Inc/Dec Memory ============

  private inc_zp(): number { const addr = this.addrZp(); this.memory[addr] = (this.memory[addr] + 1) & 0xff; this.setNZ(this.memory[addr]); return 5; }
  private inc_zpx(): number { const addr = this.addrZpX(); this.memory[addr] = (this.memory[addr] + 1) & 0xff; this.setNZ(this.memory[addr]); return 6; }
  private inc_abs(): number { const addr = this.addrAbs(); this.memory[addr] = (this.memory[addr] + 1) & 0xff; this.setNZ(this.memory[addr]); return 6; }
  private inc_absx(): number { const addr = this.addrAbsX(); this.memory[addr] = (this.memory[addr] + 1) & 0xff; this.setNZ(this.memory[addr]); return 7; }

  private dec_zp(): number { const addr = this.addrZp(); this.memory[addr] = (this.memory[addr] - 1) & 0xff; this.setNZ(this.memory[addr]); return 5; }
  private dec_zpx(): number { const addr = this.addrZpX(); this.memory[addr] = (this.memory[addr] - 1) & 0xff; this.setNZ(this.memory[addr]); return 6; }
  private dec_abs(): number { const addr = this.addrAbs(); this.memory[addr] = (this.memory[addr] - 1) & 0xff; this.setNZ(this.memory[addr]); return 6; }
  private dec_absx(): number { const addr = this.addrAbsX(); this.memory[addr] = (this.memory[addr] - 1) & 0xff; this.setNZ(this.memory[addr]); return 7; }

  // ============ Jump Instructions ============

  private jmp_abs(): number {
    this.pc = this.readWord();
    return 3;
  }

  private jmp_ind(): number {
    const addr = this.readWord();
    // 6502 bug: if low byte is $FF, high byte comes from $xx00, not $xx00+$100
    const lo = this.memory[addr];
    const hi = this.memory[(addr & 0xff00) | ((addr + 1) & 0xff)];
    this.pc = lo | (hi << 8);
    return 5;
  }

  private jsr_abs(): number {
    const target = this.readWord();
    const returnAddr = (this.pc - 1) & 0xffff;
    this.push((returnAddr >> 8) & 0xff);
    this.push(returnAddr & 0xff);
    this.pc = target;
    return 6;
  }

  private rts(): number {
    const lo = this.pull();
    const hi = this.pull();
    this.pc = ((lo | (hi << 8)) + 1) & 0xffff;
    return 6;
  }

  // ============ Branch Instructions ============

  private branch(offset: number): number {
    const signedOffset = offset < 128 ? offset : offset - 256;
    const oldPC = this.pc;
    this.pc = (this.pc + signedOffset) & 0xffff;
    const pageCrossed = (oldPC & 0xff00) !== (this.pc & 0xff00);
    return pageCrossed ? 4 : 3;
  }

  private bpl(): number { const off = this.readByte(); return !this.negative ? this.branch(off) : 2; }
  private bmi(): number { const off = this.readByte(); return this.negative ? this.branch(off) : 2; }
  private bvc(): number { const off = this.readByte(); return !this.overflow ? this.branch(off) : 2; }
  private bvs(): number { const off = this.readByte(); return this.overflow ? this.branch(off) : 2; }
  private bcc(): number { const off = this.readByte(); return !this.carry ? this.branch(off) : 2; }
  private bcs(): number { const off = this.readByte(); return this.carry ? this.branch(off) : 2; }
  private bne(): number { const off = this.readByte(); return !this.zero ? this.branch(off) : 2; }
  private beq(): number { const off = this.readByte(); return this.zero ? this.branch(off) : 2; }

  // ============ Register Operations ============

  private inx(): number { this.x = (this.x + 1) & 0xff; this.setNZ(this.x); return 2; }
  private dex(): number { this.x = (this.x - 1) & 0xff; this.setNZ(this.x); return 2; }
  private iny(): number { this.y = (this.y + 1) & 0xff; this.setNZ(this.y); return 2; }
  private dey(): number { this.y = (this.y - 1) & 0xff; this.setNZ(this.y); return 2; }
  private tax(): number { this.x = this.a; this.setNZ(this.x); return 2; }
  private tay(): number { this.y = this.a; this.setNZ(this.y); return 2; }
  private txa(): number { this.a = this.x; this.setNZ(this.a); return 2; }
  private tya(): number { this.a = this.y; this.setNZ(this.a); return 2; }
  private txs(): number { this.sp = this.x; return 2; }
  private tsx(): number { this.x = this.sp; this.setNZ(this.x); return 2; }

  // ============ Stack Operations ============

  private push(value: number): void {
    this.memory[0x0100 + this.sp] = value;
    this.sp = (this.sp - 1) & 0xff;
  }

  private pull(): number {
    this.sp = (this.sp + 1) & 0xff;
    return this.memory[0x0100 + this.sp];
  }

  private pha(): number { this.push(this.a); return 3; }
  private pla(): number { this.a = this.pull(); this.setNZ(this.a); return 4; }

  private php(): number {
    // PHP pushes flags with B flag set
    this.push(this.getStatusByte() | 0x10);
    return 3;
  }

  private plp(): number {
    this.setStatusByte(this.pull());
    return 4;
  }

  // ============ Flag Operations ============

  private clc(): number { this.carry = false; return 2; }
  private sec(): number { this.carry = true; return 2; }
  private cli(): number { this.interruptDisable = false; return 2; }
  private sei(): number { this.interruptDisable = true; return 2; }
  private clv(): number { this.overflow = false; return 2; }
  private cld(): number { return 2; } // Decimal mode (not implemented)
  private sed(): number { return 2; } // Decimal mode (not implemented)

  // ============ Misc ============

  private nop(): number { return 2; }

  private brk(): number {
    this.pc = (this.pc + 1) & 0xffff;
    this.push((this.pc >> 8) & 0xff);
    this.push(this.pc & 0xff);
    this.push(this.getStatusByte() | 0x10);
    this.pc = this.memory[0xfffe] | (this.memory[0xffff] << 8);
    return 7;
  }

  private rti(): number {
    this.setStatusByte(this.pull());
    const lo = this.pull();
    const hi = this.pull();
    this.pc = lo | (hi << 8);
    return 6;
  }

  // ============ BIT Test ============

  private bit_zp(): number {
    const value = this.memory[this.addrZp()];
    this.zero = (this.a & value) === 0;
    this.negative = !!(value & 0x80);
    this.overflow = !!(value & 0x40);
    return 3;
  }

  private bit_abs(): number {
    const value = this.memory[this.addrAbs()];
    this.zero = (this.a & value) === 0;
    this.negative = !!(value & 0x80);
    this.overflow = !!(value & 0x40);
    return 4;
  }

  // ============ Control (Custom) ============

  private hlt(): number {
    this.halted = true;
    return 1;
  }

  // ============ Helpers ============

  private setNZ(value: number): void {
    this.zero = value === 0;
    this.negative = !!(value & 0x80);
  }

  private getStatusByte(): number {
    // Status register: NV-BDIZC
    // Bit 5 is always 1 (unused)
    // Bit 4 is B flag (only set in software BRK, not hardware interrupts)
    return (
      (this.carry ? 0x01 : 0) |           // C
      (this.zero ? 0x02 : 0) |            // Z
      (this.interruptDisable ? 0x04 : 0) | // I
      0x20 |                               // Unused bit always set
      (this.overflow ? 0x40 : 0) |        // V
      (this.negative ? 0x80 : 0)          // N
    );
  }

  private setStatusByte(value: number): void {
    this.carry = !!(value & 0x01);
    this.zero = !!(value & 0x02);
    this.interruptDisable = !!(value & 0x04);
    this.overflow = !!(value & 0x40);
    this.negative = !!(value & 0x80);
  }

  // ============ Debug Helpers ============

  getState(): {
    a: number;
    x: number;
    y: number;
    sp: number;
    pc: number;
    flags: number;
    halted: boolean;
    cycles: number;
  } {
    return {
      a: this.a,
      x: this.x,
      y: this.y,
      sp: this.sp,
      pc: this.pc,
      flags: this.getStatusByte(),
      halted: this.halted,
      cycles: this.cycles,
    };
  }
}
