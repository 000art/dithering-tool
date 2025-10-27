function matrixForEach(data, callback) {
    for (let y = 0; y < data.length; y++)
        for (let x = 0; x < data[y].length; x++)
            callback(data[y][x], x, y)
}


function toGrayscale([r, g, b]) {
    return r * 0.3 + g * 0.59 + b * 0.11;
}


function quant(color, bits) {
    return Math.round( (color / bits)) * bits
}

function quantization([r, g, b], bits) {
    bits = 255 / bits;
    return [r, g, b].map(e => quant(e, bits))
}


class OrderedDithering {

    static types = {
        '2X2 map': [
            [0, 2],
            [3, 1],
        ],
        '4X4 map': [
            [ 0,  8,  2, 10],
            [12,  4, 14,  6],
            [ 3, 11,  1,  9],
            [15,  7, 13,  5],
        ],
        '8X8 map': [
            [ 0, 32,  8, 40,  2, 34, 10, 42],
            [48, 16, 56, 24, 50, 18, 58, 26],
            [12, 44,  4, 36, 14, 46,  6, 38],
            [60, 28, 52, 20, 62, 30, 54, 22],
            [ 3, 35, 11, 43,  1, 33,  9, 41],
            [51, 19, 59, 27, 49, 17, 57, 25],
            [15, 47,  7, 39, 13, 45,  5, 37],
            [63, 31, 55, 23, 61, 29, 53, 21]
        ],
    }
        

    static create(data, type, bits) {
        let l = this.types[type].length;
        let d = l ** 2;

        matrixForEach(data, (p, x, y) => {
            let factor = this.types[type][y % l][x % l];

            let bayer = 255 / bits * (factor / d - 0.5);
            for (let i = 0; i < 3; i++) {
                p[i] = p[i] + bayer;
            }
            [p[0], p[1], p[2]] = quantization(p, bits);
        });
    }

}


class DiffusionDithering {

    static types = {
        'Floyd Steinberg': [
            [0,  1, 7, 16],
            [1, -1, 3, 16],
            [1,  0, 5, 16],
            [1,  1, 1, 16],
        ],
        'Jarvis, Judice, Nink': [
            [0,  1, 7, 48],
            [0,  2, 5, 48],
            [1, -2, 3, 48],
            [1, -1, 5, 48],
            [1,  0, 7, 48],
            [1,  1, 5, 48],
            [1,  2, 3, 48],
            [2, -2, 1, 48],
            [2, -1, 3, 48],
            [2,  0, 5, 48],
            [2,  1, 3, 48],
            [2,  2, 1, 48],
        ],
        'Stucki': [
            [0,  1, 8, 42],
            [0,  2, 4, 42],
            [1, -2, 2, 42],
            [1, -1, 4, 42],
            [1,  0, 8, 42],
            [1,  1, 4, 42],
            [1,  2, 2, 42],
            [2, -2, 1, 42],
            [2, -1, 2, 42],
            [2,  0, 4, 42],
            [2,  1, 2, 42],
            [2,  2, 1, 42],
        ],
        'Atkinson': [
            [0,  1, 1, 8],
            [0,  2, 1, 8],
            [1, -1, 1, 8],
            [1,  0, 1, 8],
            [1,  1, 1, 8],
            [2,  0, 1, 8],
        ],
        'Burkes': [
            [0,  1, 8, 32],
            [0,  2, 4, 32],
            [1, -2, 2, 32],
            [1, -1, 4, 32],
            [1,  0, 8, 32],
            [1,  1, 4, 32],
            [1,  2, 2, 32],
        ],
        'One-dimensional horizontal': [
            [0, 1, 1, 1],
        ],
        'One-dimensional vertical': [
            [1, 0, 1, 1],
        ],
        'Two-dimensional': [
            [0, 1, 1, 2],
            [1, 0, 1, 2],
        ],
        'DTH glitch 1': [
            [0, 1, 1, 1],
            [-1, 2, 2, 1],
        ],
        'DTH glitch 2': [
            [0, 3, 1, 1],
        ],
        'DTH glitch 3': [
            [4, 0, 1, 1],
        ],
    }

    static errorDiffusion(data, type, bits) {
        let diffusion = (color, error) => {
            let [r, g, b] = color;
            [color[0], color[1], color[2]] = [r, g, b].map(e => e + error);
        }
        
        matrixForEach(data, (p, x, y) => {
            let oP = [...p];
            let nP =  quantization(p, bits);
            [p[0], p[1], p[2]] = nP;
            let quantError = toGrayscale(oP) - toGrayscale(nP);
            this.types[type].forEach(e => {
                try { diffusion(data[y + e[0]][x + e[1]], quantError * e[2] / e[3]) } catch {}
            });
        });
    }

}


class UI {

    constructor(nav) {
        if (nav) this.createInputs(nav);
    }

    createButton(inner, callback) {
        let btn = document.createElement('button');
        btn.onclick = callback;
        return btn;
    }

    createFile({name, inner, callback}) {
        let block = document.createElement('div');
        block.className = 'settings_p';
        block.innerHTML = `
         <div class="settings_dscr">
            <div class="settings_name">${name}</div>
         </div>
         <label class="settings_file">
             <input type="file">
             Choise file
         </label>
        `;
        block.querySelector('input').onchange = callback;
        return block;
    }

    createSelect({name, options, callback, selected}) {

        let block = document.createElement('div');
        block.className = 'settings_p';
        block.innerHTML = `
            <div class="settings_dscr">
                <div class="settings_name">${name}</div>
            </div>
        `;

        let slct = document.createElement('select');
        block.append(slct);
        Object.keys(options).forEach(group => {
            slct.innerHTML += `<optgroup label="${group}">`;
            options[group].forEach((e, i) => {
                slct.innerHTML += `<option value="${e}" ${selected == e ? 'selected' : ''}>${e}</option>`
            });
            slct.innerHTML += `</optgroup>`;
        })

        slct.onchange = callback;
        return block;
    }

    createRange({name, min, max, step, value, callback}) {
        let block = document.createElement('div');
        block.className = 'settings_p';
        block.innerHTML = `
                <div class="settings_dscr">
                    <div class="settings_name">${name}</div>
                    <div class="settings_val">${value}</div>
                </div>
                <input type="range"
                    min="${min}"
                    max="${max}"
                    step="${step}"
                    value="${value}"
                 >`;
        block.querySelector('input').oninput = e => {
            let val = + e.target.value;
            block.querySelector('.settings_val').innerHTML = val;
            callback(e);
        }
        return block;
    }

    createNumber({name, min, max, step, value, callback}) {
        let block = document.createElement('div');
        block.className = 'settings_p';
        block.innerHTML = `
                <div class="settings_dscr">
                    <div class="settings_name">${name}</div>
                </div>
                <input type="number"
                    min="${min}"
                    max="${max}"
                    step="${step}"
                    value="${value}"
                 >`;
        block.querySelector('input').oninput = callback;
        
        return block;
    }

    createToggle({names, state, callback}) {
        let block = document.createElement('div');
        block.className = 'settings_p';
        let btn = document.createElement('button');
        btn.innerHTML = names[state ? 1: 0];
        btn.className = 'settings_toggle' + (state ? ' active' : '');
        block.append(btn)
        btn.onclick = (e) => {
            state = !state;
            btn.classList.toggle('active');
            btn.innerHTML = names[state ? 1: 0];
            callback(e);
        };
        
        return block;
    }


    createInputs(nav, space) {
        if (!space) space = document.querySelector('.setting');
        nav.forEach(e => {
            switch (e.type) {
                case 'number' : space.append(this.createNumber(e)); break;
                case 'range'  : space.append(this.createRange(e)); break;
                case 'select' : space.append(this.createSelect(e)); break;
                case 'file' : space.append(this.createFile(e)); break;
                case 'toggle' : space.append(this.createToggle(e)); break;
            }
        });
    }

}


class Main {

    settings = {
        size: 300,
        zoom: 1,
        brightness: 100,
        contrast: 100,
        'bit depth': 1,
        type: 'Floyd Steinberg',
        colored: false,
    }

    nav = [
        {type: 'file', name: 'Choise your image', inner: 'Choise', callback: this.load.bind(this)},
        {type: 'select', name: 'Dithering type', options: {'Diffusion Dithering': Object.keys(DiffusionDithering.types), 'Ordered Dithering': Object.keys(OrderedDithering.types)}, selected:this.settings.type, callback: ({target}) => this.set('type', target.value)},
        {type: 'toggle', names: ['monochrome', 'colored'], state: this.settings.colored, callback: () => this.set('colored', !this.settings.colored)},
        {type: 'number', name: 'size', min: 50, max: 1000, step: 10, value: this.settings.size, callback: this.input('size')},
        {type: 'range', name: 'zoom', min: 1, max: 6, step: 1, value: this.settings.zoom, callback: this.input('zoom')},
        {type: 'range', name: 'brightness', min: 0, max: 400, step: 1, value: this.settings.brightness, callback: this.input('brightness')},
        {type: 'range', name: 'contrast', min: 0, max: 400, step: 1, value: this.settings.contrast, callback: this.input('contrast')},
        {type: 'range', name: 'bit depth', min: 1, max: 32, step: 1, value: this.settings['bit depth'], callback: this.input('bit depth')},
    ]

    canvas = document.querySelector('canvas');
    ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    img = new Image();

    constructor() {
        let ui = new UI(this.nav, DiffusionDithering.types);
    }

    input(prop) { return ({target}) => this.set(prop, + target.value) }

    set(prop, value) {
        this.settings[prop] = value;
        this.createData();
    }

    load({target}) {
        let file = target.files[0];
        if (!file) return;
        let url = URL.createObjectURL(file);
        new Promise(r => {
            this.img.onload = () => r();
            this.img.src = url;
        }).then(e => this.createData());
    }

    draw(matrix) {
        let zoom = this.settings.zoom;
        matrixForEach(matrix, (e, x, y) => {
            this.ctx.fillStyle = `rgba(${e})`;
            this.ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
        })
    }

    createMatrix(data, w, h) {
        let matrix = [];
        let i = 0;
        for (let y = 0; y < h; y++) {
            matrix.push([]);
            for (let x = 0; x < w; x++) {
                matrix[y][x] = [data[i+0], data[i+1], data[i+2], data[i+3]];
                i += 4;
            }
        }
        return matrix;
    }

    createData() {
        if (!this.img.src) return;
        let ratio = this.img.naturalWidth / this.img.naturalHeight;
        let [w, h] = [this.settings.size, this.settings.size / ratio];

        let zoom = this.settings.zoom;
        [this.canvas.width, this.canvas.height] = [w, h];

        this.ctx.imageSmoothingEnabled = false;
        this.ctx.filter = `brightness(${this.settings.brightness}%) contrast(${this.settings.contrast}%)`;
        this.ctx.drawImage(this.img, 0, 0, w, h);
        this.ctx.filter = "none";

        let rowData = this.ctx.getImageData(0, 0, w, h);
        let matrix = this.createMatrix(rowData.data, w, h);
        
        this.dithering(matrix, w, h);
    }

    dithering(data, w, h) {
        if (!this.settings.colored) {
            matrixForEach(data, (p, x, y) => {
                let l = toGrayscale(p);
                [p[0], p[1], p[2]] = [l, l, l];
            });
        }

        if (Object.keys(OrderedDithering.types).includes(this.settings.type))
            OrderedDithering.create(data, this.settings.type, this.settings['bit depth']);

        if (Object.keys(DiffusionDithering.types).includes(this.settings.type))
            DiffusionDithering.errorDiffusion(data, this.settings.type, this.settings['bit depth'])
        
        let z = this.settings.zoom;
        [this.canvas.width, this.canvas.height] = [w * z, h * z];

        this.draw(data);
    }

}


new Main();