import { Terminal as xterm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

export class Terminal {
	handle: xterm;
	elementRef: HTMLElement;
	socket: WebSocket | undefined;
	_fitAddon: FitAddon;

	constructor(target: HTMLElement) {
		this.elementRef = target;
		this._fitAddon = new FitAddon();
		this.handle = new xterm({
			scrollback: 1000,
			scrollOnUserInput: true,
			smoothScrollDuration: 100,
			rows: 40,
			cols: 80,
			cursorBlink: true,
			cursorStyle: 'bar',
			fontFamily: 'Fira Code, monospace',
			fontSize: 12,
			theme: {
				background: 'mc-gray-600',
				foreground: 'mc-gray-100'
			},
			allowProposedApi: true
		});
		this.handle.loadAddon(this._fitAddon);
		this.handle.loadAddon(new WebLinksAddon());

		this.handle.open(this.elementRef);
		this._fitAddon.fit();
		this.handle.focus();
	}

	public initSocket(socket: WebSocket) {
		this.socket = socket;
		this.handle.onData((data) => {
			socket.send(data);
		});

		socket.addEventListener('message', (event) => {
			this.handle.write(event.data);
		});
	}

	public resize(dimensions: { rows: number; cols: number } | undefined) {
		if (!dimensions) {
			return this._fitAddon.fit();
		}
		this.handle.resize(dimensions.cols, dimensions.rows);
	}

	public proposeDimensions() {
		if (this._fitAddon) {
			return this._fitAddon.proposeDimensions();
		}
	}

	public currentDimensions() {
		return {
			rows: this.handle.rows,
			cols: this.handle.cols
		};
	}
}
