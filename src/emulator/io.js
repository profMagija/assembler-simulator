app.service('io', [function () {
    var in_character = 0;
    var in_keys = 0;

    document.addEventListener('keypress', function (ev) {
        var charCode = ev.charCode || 0;
        in_character = charCode;
    });

    document.addEventListener('keydown', function (ev) {
        switch (ev.key) {
            case "Escape": in_keys |= 0x80; break;
            case "Shift": in_keys |= 0x40; break;
            case "Control": in_keys |= 0x20; break;
            case "Backspace": in_keys |= 0x10; break;
            case "ArrowUp": in_keys |= 0x08; break;
            case "ArrowDown": in_keys |= 0x04; break;
            case "ArrowLeft": in_keys |= 0x02; break;
            case "ArrowRight": in_keys |= 0x01; break;
        }
    });

    var io = {
        reset: function () {
            in_character = 0;
            in_keys = 0;
        },
        
        read_from_port: function (port) {
            switch (port) {
                case 0:
                    return in_character;
                case 1:
                    return in_keys;
                default:
                    return 0;
            }
        },

        write_to_port: function (port, value) {
            switch (port) {
                case 0:
                    in_character = value;
                    break;
                case 1:
                    in_keys = value;
                    break;
            }
        }
    };

    return io;
}]);