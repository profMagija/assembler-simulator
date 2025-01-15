app.controller('Ctrl', ['$document', '$scope', '$timeout', 'cpu', 'memory', 'assembler', function ($document, $scope, $timeout, cpu, memory, assembler) {
    $scope.memory = memory;
    $scope.cpu = cpu;
    $scope.error = '';
    $scope.isRunning = false;
    $scope.displayHex = true;
    $scope.displayInstr = false;
    $scope.displayA = false;
    $scope.displayB = false;
    $scope.displayC = false;
    $scope.displayD = false;
    $scope.speeds = [
        { speed: 1, desc: "1 Hz" },
        { speed: 2, desc: "2 Hz" },
        { speed: 5, desc: "5 Hz" },
        { speed: 10, desc: "10 Hz" },
        { speed: 50, desc: "50 Hz" },
        { speed: 100, desc: "100 Hz" },
        { speed: Infinity, desc: "Turbo" },
    ];
    $scope.speed = 10;
    $scope.outputStartIndex = 240;
    $scope.bitmapMode = false;

    $scope.codeSize = 0;

    $scope.code = "";
    function shouldHighlightLines() {
        return !$scope.isRunning;
    }

    $scope.reset = function () {
        cpu.reset();
        memory.reset();
        $scope.error = '';
        $scope.selectedLine = -1;
        $scope.mapping = {};
        $scope.labels = {};
        $scope.codeSize = 0;
    };

    $scope.executeStep = function () {
        try {
            // Execute
            var res = cpu.step();

            // Mark in code
            if (shouldHighlightLines() && (cpu.ip in $scope.mapping)) {
                $scope.selectedLine = $scope.mapping[cpu.ip];
            }

            return res;
        } catch (e) {
            console.error(e);
            $scope.error = e;
            return false;
        }
    };

    var runner;
    $scope.run = function () {
        $scope.isRunning = true;
        runner = $timeout(function () {
            if ($scope.executeStep() === true) {
                $scope.run();
            } else {
                $scope.isRunning = false;
            }
        }, 1000 / $scope.speed);
    };

    $scope.stop = function () {
        $timeout.cancel(runner);
        $scope.isRunning = false;
    };

    $scope.checkPrgrmLoaded = function () {
        for (var i = 0, l = memory.data.length; i < l; i++) {
            if (memory.data[i] !== 0) {
                return true;
            }
        }

        return false;
    };

    $scope.changeVideoMode = function () {
        $scope.bitmapMode = !$scope.bitmapMode;
    };

    $scope.curVideoMode = function () {
        return $scope.bitmapMode ? "Dot-Matrix" : "Character";
    };
    
    $scope.getCharClass = function (value) {
        return value < 128 ? "output-normal" : "output-inverted";
    };

    $scope.getChar = function (value) {
        var HIGH = " ░▒▓█▀▄◼◻●○◀▶▼▲▪";
        var text;
        if (value >= 128) {
            value -= 128;
        }
        if (value >= 32) {
            text = String.fromCharCode(value);
        } else {
            text = HIGH[value] || "";
        }

        if (text.trim() === '') {
            return '\u00A0\u00A0';
        } else {
            return text;
        }
    };

    $scope.getCharBitmap = function (value, row) {
        var pix = (value & (1 << row)) !== 0;
        return pix ? 'on' : 'off';
    };

    $scope.assemble = function () {
        try {
            $scope.reset();

            var assembly = assembler.go($scope.code);
            $scope.mapping = assembly.mapping;
            var binary = assembly.code;
            $scope.labels = assembly.labels;

            if (binary.length > memory.data.length)
                throw "Binary code does not fit into the memory. Max " + memory.data.length + " bytes are allowed";

            for (var i = 0, l = binary.length; i < l; i++) {
                memory.data[i] = binary[i];
            }

            $scope.codeSize = binary.length;
        } catch (e) {
            if (e.line !== undefined) {
                $scope.error = e.line + " | " + e.error;
                $scope.selectedLine = e.line;
            } else {
                $scope.error = e.error;
            }
        }
    };

    $scope.jumpToLine = function (index) {
        if (shouldHighlightLines()) {
            $document[0].getElementById('sourceCode').scrollIntoView();
            $scope.selectedLine = $scope.mapping[index];
        }
    };


    $scope.isInstruction = function (index) {
        return $scope.mapping !== undefined &&
            $scope.mapping[index] !== undefined &&
            $scope.displayInstr;
    };

    $scope.getMemoryCellCss = function (index) {
        if (index >= $scope.outputStartIndex) {
            return 'output-bg';
        } else if ($scope.isInstruction(index)) {
            return 'instr-bg';
        } else if (index < $scope.codeSize) {
            return 'code-bg';
        } else if (index > cpu.sp && index <= cpu.maxSP) {
            return 'stack-bg';
        } else {
            return '';
        }
    };

    $scope.getMemoryInnerCellCss = function (index) {
        if (index === cpu.ip) {
            return 'marker marker-ip';
        } else if (index === cpu.sp) {
            return 'marker marker-sp';
        } else if (index === cpu.gpr[0] && $scope.displayA) {
            return 'marker marker-a';
        } else if (index === cpu.gpr[1] && $scope.displayB) {
            return 'marker marker-b';
        } else if (index === cpu.gpr[2] && $scope.displayC) {
            return 'marker marker-c';
        } else if (index === cpu.gpr[3] && $scope.displayD) {
            return 'marker marker-d';
        } else {
            return '';
        }
    };
}]);
