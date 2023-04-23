app.service('memory', [function () {
    var memory = {
        data: Array(256),
        lastAccess: -1,
        load: function (address) {
            var self = this;

            if (address < 0 || address >= self.data.length) {
                address = ((address % 256) + 256) % 256;
            }

            self.lastAccess = address;
            return self.data[address];
        },
        store: function (address, value) {
            var self = this;

            if (address < 0 || address >= self.data.length) {
                address = ((address % 256) + 256) % 256;
            }

            self.lastAccess = address;
            self.data[address] = value;
        },
        reset: function () {
            var self = this;

            self.lastAccess = -1;
            for (var i = 0, l = self.data.length; i < l; i++) {
                self.data[i] = 0;
            }
        }
    };

    memory.reset();
    return memory;
}]);
