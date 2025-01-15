app.service('cpu', ['opcodes', 'memory', 'io', function (opcodes, memory, io) {
    var cpu = {
        step: function () {
            var self = this;

            if (self.fault === true) {
                throw "FAULT. Reset to continue.";
            }

            try {
                var checkGPR = function (reg) {
                    if (reg < 0 || reg >= self.gpr.length) {
                        throw "Invalid register: " + reg;
                    } else {
                        return reg;
                    }
                };

                var checkGPR_SP = function (reg) {
                    if (reg < 0 || reg >= 1 + self.gpr.length) {
                        throw "Invalid register: " + reg;
                    } else {
                        return reg;
                    }
                };

                var setGPR_SP = function (reg, value) {
                    if (reg >= 0 && reg < self.gpr.length) {
                        self.gpr[reg] = value;
                    } else if (reg == self.gpr.length) {
                        self.sp = value;
                    } else {
                        throw "Invalid register: " + reg;
                    }
                };

                var getGPR_SP = function (reg) {
                    if (reg >= 0 && reg < self.gpr.length) {
                        return self.gpr[reg];
                    } else if (reg == self.gpr.length) {
                        return self.sp;
                    } else {
                        throw "Invalid register: " + reg;
                    }
                };

                var indirectRegisterAddress = function (value) {
                    var reg = value % 8;

                    var base;
                    if (reg < self.gpr.length) {
                        base = self.gpr[reg];
                    } else {
                        base = self.sp;
                    }

                    var offset = Math.floor(value / 8);
                    if (offset > 15) {
                        offset = offset - 32;
                    }

                    return base + offset;
                };

                var checkOperation = function (value) {
                    self.zero = false;
                    self.carry = false;

                    if (value >= 256) {
                        self.carry = true;
                        value = value % 256;
                    } else if (value < 0) {
                        self.carry = true;
                        value = 256 - (-value) % 256;
                    }

                    if (value === 0) {
                        self.zero = true;
                    }

                    return value;
                };
                
                var shiftLeft = function (value, shift) {
                    if (shift === 0) {
                        self.carry = false;
                        self.zero = false;
                        return value;
                    }
                    
                    if (shift > 8) {
                        self.carry = false;
                        self.zero = false;
                        return 0;
                    }
                    
                    var result = value << shift;
                    self.carry = (result & 0x100) !== 0;
                    result &= 0xFF;
                    self.zero = result === 0;
                    return result;
                };
                
                var shiftRight = function (value, shift) {
                    if (shift === 0) {
                        self.carry = false;
                        self.zero = false;
                        return value;
                    }
                    
                    if (shift > 8) {
                        self.carry = false;
                        self.zero = false;
                        return 0;
                    }
                    
                    var result = value >> shift;
                    self.carry = (value & (1 << (shift - 1))) !== 0;
                    self.zero = result === 0;
                    return result;
                };

                var rotateLeft = function (value, shift) {
                    if (shift === 0) {
                        self.carry = false;
                        self.zero = false;
                        return value;
                    }

                    shift = shift % 8;
                    var result = ((value << shift) & 0xFF) | (value >> (8 - shift));
                    self.carry = (result & 1) !== 0;
                    self.zero = result === 0;
                    return result;
                };

                var rotateRight = function (value, shift) {
                    if (shift === 0) {
                        self.carry = false;
                        self.zero = false;
                        return value;
                    }

                    shift = shift % 8;
                    var result = (value >> shift) | ((value << (8 - shift)) & 0xFF);
                    self.carry = (result & 0x80) !== 0;
                    self.zero = result === 0;
                    return result;
                };

                var jump = function (newIP) {
                    self.ip = newIP;
                };

                var push = function (value) {
                    memory.store(self.sp--, value);
                };

                var pop = function () {
                    var value = memory.load(++self.sp);
                    return value;
                };

                var division = function (divisor) {
                    if (divisor === 0) {
                        throw "Division by 0";
                    }

                    return Math.floor(self.gpr[0] / divisor);
                };

                var adjust8its = function (value) {
                    if (value < 0 || value >= 256) {
                        value = ((value % 256) + 256) % 256;
                    }

                    return value;
                };

                var regTo, regFrom, memFrom, memTo, number;
                var instr = memory.load(self.ip);
                switch (instr) {
                    case opcodes.NOP:
                        self.ip++;
                        break;
                    case opcodes.MOV_REG_TO_REG:
                        regTo = checkGPR_SP(memory.load(++self.ip));
                        regFrom = checkGPR_SP(memory.load(++self.ip));
                        setGPR_SP(regTo, getGPR_SP(regFrom));
                        self.ip++;
                        break;
                    case opcodes.MOV_ADDRESS_TO_REG:
                        regTo = checkGPR_SP(memory.load(++self.ip));
                        memFrom = memory.load(++self.ip);
                        setGPR_SP(regTo, memory.load(memFrom));
                        self.ip++;
                        break;
                    case opcodes.MOV_REGADDRESS_TO_REG:
                        regTo = checkGPR_SP(memory.load(++self.ip));
                        regFrom = memory.load(++self.ip);
                        setGPR_SP(regTo, memory.load(indirectRegisterAddress(regFrom)));
                        self.ip++;
                        break;
                    case opcodes.MOV_REG_TO_ADDRESS:
                        memTo = memory.load(++self.ip);
                        regFrom = checkGPR_SP(memory.load(++self.ip));
                        memory.store(memTo, getGPR_SP(regFrom));
                        self.ip++;
                        break;
                    case opcodes.MOV_REG_TO_REGADDRESS:
                        regTo = memory.load(++self.ip);
                        regFrom = checkGPR_SP(memory.load(++self.ip));
                        memory.store(indirectRegisterAddress(regTo), getGPR_SP(regFrom));
                        self.ip++;
                        break;
                    case opcodes.MOV_NUMBER_TO_REG:
                        regTo = checkGPR_SP(memory.load(++self.ip));
                        number = memory.load(++self.ip);
                        setGPR_SP(regTo, number);
                        self.ip++;
                        break;
                    case opcodes.MOV_NUMBER_TO_ADDRESS:
                        memTo = memory.load(++self.ip);
                        number = memory.load(++self.ip);
                        memory.store(memTo, number);
                        self.ip++;
                        break;
                    case opcodes.MOV_NUMBER_TO_REGADDRESS:
                        regTo = memory.load(++self.ip);
                        number = memory.load(++self.ip);
                        memory.store(indirectRegisterAddress(regTo), number);
                        self.ip++;
                        break;
                    case opcodes.ADD_REG_TO_REG:
                        regTo = checkGPR_SP(memory.load(++self.ip));
                        regFrom = checkGPR_SP(memory.load(++self.ip));
                        setGPR_SP(regTo, checkOperation(getGPR_SP(regTo) + getGPR_SP(regFrom)));
                        self.ip++;
                        break;
                    case opcodes.ADD_REGADDRESS_TO_REG:
                        regTo = checkGPR_SP(memory.load(++self.ip));
                        regFrom = memory.load(++self.ip);
                        setGPR_SP(regTo, checkOperation(getGPR_SP(regTo) + memory.load(indirectRegisterAddress(regFrom))));
                        self.ip++;
                        break;
                    case opcodes.ADD_ADDRESS_TO_REG:
                        regTo = checkGPR_SP(memory.load(++self.ip));
                        memFrom = memory.load(++self.ip);
                        setGPR_SP(regTo, checkOperation(getGPR_SP(regTo) + memory.load(memFrom)));
                        self.ip++;
                        break;
                    case opcodes.ADD_NUMBER_TO_REG:
                        regTo = checkGPR_SP(memory.load(++self.ip));
                        number = memory.load(++self.ip);
                        setGPR_SP(regTo, checkOperation(getGPR_SP(regTo) + number));
                        self.ip++;
                        break;
                    case opcodes.SUB_REG_FROM_REG:
                        regTo = checkGPR_SP(memory.load(++self.ip));
                        regFrom = checkGPR_SP(memory.load(++self.ip));
                        setGPR_SP(regTo, checkOperation(getGPR_SP(regTo) - self.gpr[regFrom]));
                        self.ip++;
                        break;
                    case opcodes.SUB_REGADDRESS_FROM_REG:
                        regTo = checkGPR_SP(memory.load(++self.ip));
                        regFrom = memory.load(++self.ip);
                        setGPR_SP(regTo, checkOperation(getGPR_SP(regTo) - memory.load(indirectRegisterAddress(regFrom))));
                        self.ip++;
                        break;
                    case opcodes.SUB_ADDRESS_FROM_REG:
                        regTo = checkGPR_SP(memory.load(++self.ip));
                        memFrom = memory.load(++self.ip);
                        setGPR_SP(regTo, checkOperation(getGPR_SP(regTo) - memory.load(memFrom)));
                        self.ip++;
                        break;
                    case opcodes.SUB_NUMBER_FROM_REG:
                        regTo = checkGPR_SP(memory.load(++self.ip));
                        number = memory.load(++self.ip);
                        setGPR_SP(regTo, checkOperation(getGPR_SP(regTo) - number));
                        self.ip++;
                        break;
                    case opcodes.INC_REG:
                        regTo = checkGPR_SP(memory.load(++self.ip));
                        setGPR_SP(regTo, checkOperation(getGPR_SP(regTo) + 1));
                        self.ip++;
                        break;
                    case opcodes.DEC_REG:
                        regTo = checkGPR_SP(memory.load(++self.ip));
                        setGPR_SP(regTo, checkOperation(getGPR_SP(regTo) - 1));
                        self.ip++;
                        break;
                    case opcodes.CMP_REG_WITH_REG:
                        regTo = checkGPR_SP(memory.load(++self.ip));
                        regFrom = checkGPR_SP(memory.load(++self.ip));
                        checkOperation(getGPR_SP(regTo) - getGPR_SP(regFrom));
                        self.ip++;
                        break;
                    case opcodes.CMP_REGADDRESS_WITH_REG:
                        regTo = checkGPR_SP(memory.load(++self.ip));
                        regFrom = memory.load(++self.ip);
                        checkOperation(getGPR_SP(regTo) - memory.load(indirectRegisterAddress(regFrom)));
                        self.ip++;
                        break;
                    case opcodes.CMP_ADDRESS_WITH_REG:
                        regTo = checkGPR_SP(memory.load(++self.ip));
                        memFrom = memory.load(++self.ip);
                        checkOperation(getGPR_SP(regTo) - memory.load(memFrom));
                        self.ip++;
                        break;
                    case opcodes.CMP_NUMBER_WITH_REG:
                        regTo = checkGPR_SP(memory.load(++self.ip));
                        number = memory.load(++self.ip);
                        checkOperation(getGPR_SP(regTo) - number);
                        self.ip++;
                        break;
                    case opcodes.JMP_REGADDRESS:
                        regTo = checkGPR(memory.load(++self.ip));
                        jump(self.gpr[regTo]);
                        break;
                    case opcodes.JMP_ADDRESS:
                        number = memory.load(++self.ip);
                        jump(number);
                        break;
                    case opcodes.JC_REGADDRESS:
                        regTo = checkGPR(memory.load(++self.ip));
                        if (self.carry) {
                            jump(self.gpr[regTo]);
                        } else {
                            self.ip++;
                        }
                        break;
                    case opcodes.JC_ADDRESS:
                        number = memory.load(++self.ip);
                        if (self.carry) {
                            jump(number);
                        } else {
                            self.ip++;
                        }
                        break;
                    case opcodes.JNC_REGADDRESS:
                        regTo = checkGPR(memory.load(++self.ip));
                        if (!self.carry) {
                            jump(self.gpr[regTo]);
                        } else {
                            self.ip++;
                        }
                        break;
                    case opcodes.JNC_ADDRESS:
                        number = memory.load(++self.ip);
                        if (!self.carry) {
                            jump(number);
                        } else {
                            self.ip++;
                        }
                        break;
                    case opcodes.JZ_REGADDRESS:
                        regTo = checkGPR(memory.load(++self.ip));
                        if (self.zero) {
                            jump(self.gpr[regTo]);
                        } else {
                            self.ip++;
                        }
                        break;
                    case opcodes.JZ_ADDRESS:
                        number = memory.load(++self.ip);
                        if (self.zero) {
                            jump(number);
                        } else {
                            self.ip++;
                        }
                        break;
                    case opcodes.JNZ_REGADDRESS:
                        regTo = checkGPR(memory.load(++self.ip));
                        if (!self.zero) {
                            jump(self.gpr[regTo]);
                        } else {
                            self.ip++;
                        }
                        break;
                    case opcodes.JNZ_ADDRESS:
                        number = memory.load(++self.ip);
                        if (!self.zero) {
                            jump(number);
                        } else {
                            self.ip++;
                        }
                        break;
                    case opcodes.JA_REGADDRESS:
                        regTo = checkGPR(memory.load(++self.ip));
                        if (!self.zero && !self.carry) {
                            jump(self.gpr[regTo]);
                        } else {
                            self.ip++;
                        }
                        break;
                    case opcodes.JA_ADDRESS:
                        number = memory.load(++self.ip);
                        if (!self.zero && !self.carry) {
                            jump(number);
                        } else {
                            self.ip++;
                        }
                        break;
                    case opcodes.JNA_REGADDRESS: // JNA REG
                        regTo = checkGPR(memory.load(++self.ip));
                        if (self.zero || self.carry) {
                            jump(self.gpr[regTo]);
                        } else {
                            self.ip++;
                        }
                        break;
                    case opcodes.JNA_ADDRESS:
                        number = memory.load(++self.ip);
                        if (self.zero || self.carry) {
                            jump(number);
                        } else {
                            self.ip++;
                        }
                        break;
                    case opcodes.PUSH_REG:
                        regFrom = checkGPR(memory.load(++self.ip));
                        push(self.gpr[regFrom]);
                        self.ip++;
                        break;
                    case opcodes.PUSH_REGADDRESS:
                        regFrom = memory.load(++self.ip);
                        push(memory.load(indirectRegisterAddress(regFrom)));
                        self.ip++;
                        break;
                    case opcodes.PUSH_ADDRESS:
                        memFrom = memory.load(++self.ip);
                        push(memory.load(memFrom));
                        self.ip++;
                        break;
                    case opcodes.PUSH_NUMBER:
                        number = memory.load(++self.ip);
                        push(number);
                        self.ip++;
                        break;
                    case opcodes.POP_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        self.gpr[regTo] = pop();
                        self.ip++;
                        break;
                    case opcodes.CALL_REGADDRESS:
                        regTo = checkGPR(memory.load(++self.ip));
                        push(self.ip + 1);
                        jump(self.gpr[regTo]);
                        break;
                    case opcodes.CALL_ADDRESS:
                        number = memory.load(++self.ip);
                        push(self.ip + 1);
                        jump(number);
                        break;
                    case opcodes.RET:
                        jump(pop());
                        break;
                    case opcodes.MUL_REG: // A = A * REG
                        regFrom = checkGPR(memory.load(++self.ip));
                        self.gpr[0] = checkOperation(self.gpr[0] * self.gpr[regFrom]);
                        self.ip++;
                        break;
                    case opcodes.MUL_REGADDRESS: // A = A * [REG]
                        regFrom = memory.load(++self.ip);
                        self.gpr[0] = checkOperation(self.gpr[0] * memory.load(indirectRegisterAddress(regFrom)));
                        self.ip++;
                        break;
                    case opcodes.MUL_ADDRESS: // A = A * [NUMBER]
                        memFrom = memory.load(++self.ip);
                        self.gpr[0] = checkOperation(self.gpr[0] * memory.load(memFrom));
                        self.ip++;
                        break;
                    case opcodes.MUL_NUMBER: // A = A * NUMBER
                        number = memory.load(++self.ip);
                        self.gpr[0] = checkOperation(self.gpr[0] * number);
                        self.ip++;
                        break;
                    case opcodes.DIV_REG: // A = A / REG
                        regFrom = checkGPR(memory.load(++self.ip));
                        self.gpr[0] = checkOperation(division(self.gpr[regFrom]));
                        self.ip++;
                        break;
                    case opcodes.DIV_REGADDRESS: // A = A / [REG]
                        regFrom = memory.load(++self.ip);
                        self.gpr[0] = checkOperation(division(memory.load(indirectRegisterAddress(regFrom))));
                        self.ip++;
                        break;
                    case opcodes.DIV_ADDRESS: // A = A / [NUMBER]
                        memFrom = memory.load(++self.ip);
                        self.gpr[0] = checkOperation(division(memory.load(memFrom)));
                        self.ip++;
                        break;
                    case opcodes.DIV_NUMBER: // A = A / NUMBER
                        number = memory.load(++self.ip);
                        self.gpr[0] = checkOperation(division(number));
                        self.ip++;
                        break;
                    case opcodes.AND_REG_WITH_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        regFrom = checkGPR(memory.load(++self.ip));
                        self.gpr[regTo] = checkOperation(self.gpr[regTo] & self.gpr[regFrom]);
                        self.ip++;
                        break;
                    case opcodes.AND_REGADDRESS_WITH_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        regFrom = memory.load(++self.ip);
                        self.gpr[regTo] = checkOperation(self.gpr[regTo] & memory.load(indirectRegisterAddress(regFrom)));
                        self.ip++;
                        break;
                    case opcodes.AND_ADDRESS_WITH_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        memFrom = memory.load(++self.ip);
                        self.gpr[regTo] = checkOperation(self.gpr[regTo] & memory.load(memFrom));
                        self.ip++;
                        break;
                    case opcodes.AND_NUMBER_WITH_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        number = memory.load(++self.ip);
                        self.gpr[regTo] = checkOperation(self.gpr[regTo] & number);
                        self.ip++;
                        break;
                    case opcodes.OR_REG_WITH_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        regFrom = checkGPR(memory.load(++self.ip));
                        self.gpr[regTo] = checkOperation(self.gpr[regTo] | self.gpr[regFrom]);
                        self.ip++;
                        break;
                    case opcodes.OR_REGADDRESS_WITH_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        regFrom = memory.load(++self.ip);
                        self.gpr[regTo] = checkOperation(self.gpr[regTo] | memory.load(indirectRegisterAddress(regFrom)));
                        self.ip++;
                        break;
                    case opcodes.OR_ADDRESS_WITH_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        memFrom = memory.load(++self.ip);
                        self.gpr[regTo] = checkOperation(self.gpr[regTo] | memory.load(memFrom));
                        self.ip++;
                        break;
                    case opcodes.OR_NUMBER_WITH_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        number = memory.load(++self.ip);
                        self.gpr[regTo] = checkOperation(self.gpr[regTo] | number);
                        self.ip++;
                        break;
                    case opcodes.XOR_REG_WITH_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        regFrom = checkGPR(memory.load(++self.ip));
                        self.gpr[regTo] = checkOperation(self.gpr[regTo] ^ self.gpr[regFrom]);
                        self.ip++;
                        break;
                    case opcodes.XOR_REGADDRESS_WITH_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        regFrom = memory.load(++self.ip);
                        self.gpr[regTo] = checkOperation(self.gpr[regTo] ^ memory.load(indirectRegisterAddress(regFrom)));
                        self.ip++;
                        break;
                    case opcodes.XOR_ADDRESS_WITH_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        memFrom = memory.load(++self.ip);
                        self.gpr[regTo] = checkOperation(self.gpr[regTo] ^ memory.load(memFrom));
                        self.ip++;
                        break;
                    case opcodes.XOR_NUMBER_WITH_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        number = memory.load(++self.ip);
                        self.gpr[regTo] = checkOperation(self.gpr[regTo] ^ number);
                        self.ip++;
                        break;
                    case opcodes.NOT_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        self.gpr[regTo] = checkOperation(~self.gpr[regTo]);
                        self.ip++;
                        break;
                    case opcodes.SHL_REG_WITH_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        regFrom = checkGPR(memory.load(++self.ip));
                        self.gpr[regTo] = shiftLeft(self.gpr[regTo], self.gpr[regFrom]);
                        self.ip++;
                        break;
                    case opcodes.SHL_REGADDRESS_WITH_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        regFrom = memory.load(++self.ip);
                        self.gpr[regTo] = shiftLeft(self.gpr[regTo], memory.load(indirectRegisterAddress(regFrom)));
                        self.ip++;
                        break;
                    case opcodes.SHL_ADDRESS_WITH_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        memFrom = memory.load(++self.ip);
                        self.gpr[regTo] = shiftLeft(self.gpr[regTo], memory.load(memFrom));
                        self.ip++;
                        break;
                    case opcodes.SHL_NUMBER_WITH_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        number = memory.load(++self.ip);
                        self.gpr[regTo] = shiftLeft(self.gpr[regTo], number);
                        self.ip++;
                        break;
                    case opcodes.SHR_REG_WITH_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        regFrom = checkGPR(memory.load(++self.ip));
                        self.gpr[regTo] = shiftRight(self.gpr[regTo], self.gpr[regFrom]);
                        self.ip++;
                        break;
                    case opcodes.SHR_REGADDRESS_WITH_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        regFrom = memory.load(++self.ip);
                        self.gpr[regTo] = shiftRight(self.gpr[regTo], memory.load(indirectRegisterAddress(regFrom)));
                        self.ip++;
                        break;
                    case opcodes.SHR_ADDRESS_WITH_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        memFrom = memory.load(++self.ip);
                        self.gpr[regTo] = shiftRight(self.gpr[regTo], memory.load(memFrom));
                        self.ip++;
                        break;
                    case opcodes.SHR_NUMBER_WITH_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        number = memory.load(++self.ip);
                        self.gpr[regTo] = shiftRight(self.gpr[regTo], number);
                        self.ip++;
                        break;
                    case opcodes.ROL_REG_WITH_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        regFrom = checkGPR(memory.load(++self.ip));
                        self.gpr[regTo] = rotateLeft(self.gpr[regTo], self.gpr[regFrom]);
                        self.ip++;
                        break;
                    case opcodes.ROL_REGADDRESS_WITH_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        regFrom = memory.load(++self.ip);
                        self.gpr[regTo] = rotateLeft(self.gpr[regTo], memory.load(indirectRegisterAddress(regFrom)));
                        self.ip++;
                        break;
                    case opcodes.ROL_ADDRESS_WITH_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        memFrom = memory.load(++self.ip);
                        self.gpr[regTo] = rotateLeft(self.gpr[regTo], memory.load(memFrom));
                        self.ip++;
                        break;
                    case opcodes.ROL_NUMBER_WITH_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        number = memory.load(++self.ip);
                        self.gpr[regTo] = rotateLeft(self.gpr[regTo], number);
                        self.ip++;
                        break;
                    case opcodes.ROR_REG_WITH_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        regFrom = checkGPR(memory.load(++self.ip));
                        self.gpr[regTo] = rotateRight(self.gpr[regTo], self.gpr[regFrom]);
                        self.ip++;
                        break;
                    case opcodes.ROR_REGADDRESS_WITH_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        regFrom = memory.load(++self.ip);
                        self.gpr[regTo] = rotateRight(self.gpr[regTo], memory.load(indirectRegisterAddress(regFrom)));
                        self.ip++;
                        break;
                    case opcodes.ROR_ADDRESS_WITH_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        memFrom = memory.load(++self.ip);
                        self.gpr[regTo] = rotateRight(self.gpr[regTo], memory.load(memFrom));
                        self.ip++;
                        break;
                    case opcodes.ROR_NUMBER_WITH_REG:
                        regTo = checkGPR(memory.load(++self.ip));
                        number = memory.load(++self.ip);
                        self.gpr[regTo] = rotateRight(self.gpr[regTo], number);
                        self.ip++;
                        break;
                    case opcodes.RND_REG:
                        regTo = checkGPR_SP(memory.load(++self.ip));
                        setGPR_SP(regTo, Math.floor(Math.random() * 256));
                        self.ip++;
                        break;
                    case opcodes.IN_REG_PORT:
                        regTo = checkGPR_SP(memory.load(++self.ip));
                        portFrom = memory.load(++self.ip);
                        setGPR_SP(regTo, io.read_from_port(portFrom));
                        self.ip++;
                        break;
                    case opcodes.OUT_PORT_REG:
                        portTo = memory.load(++self.ip);
                        regFrom = checkGPR(memory.load(++self.ip));
                        io.write_to_port(portTo, self.gpr[regFrom]);
                        self.ip++;
                        break;
                    case opcodes.OUT_PORT_NUMBER:
                        portTo = memory.load(++self.ip);
                        value = memory.load(++self.ip);
                        io.write_to_port(portTo, value);
                        self.ip++;
                        break;
                    case opcodes.HALT:
                        return false;
                    default:
                        throw "Invalid op code: " + instr;
                }

                self.ip = adjust8its(self.ip);
                self.sp = adjust8its(self.sp);
                self.gpr[0] = adjust8its(self.gpr[0]);
                self.gpr[1] = adjust8its(self.gpr[1]);
                self.gpr[2] = adjust8its(self.gpr[2]);
                self.gpr[3] = adjust8its(self.gpr[3]);

                return true;
            } catch (e) {
                self.fault = true;
                throw e;
            }
        },
        reset: function () {
            var self = this;
            self.maxSP = 239;
            self.minSP = 0;

            self.gpr = [0, 0, 0, 0];
            self.sp = self.maxSP;
            self.ip = 0;
            self.zero = false;
            self.carry = false;
            self.fault = false;

            io.reset();
        }
    };

    cpu.reset();
    return cpu;
}]);
