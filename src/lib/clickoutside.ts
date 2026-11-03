export function clickOutside(node: Node, onOutsideClick?: () => void) {
	// the node has been mounted in the DOM

	window.addEventListener('click', handleClick);

	function handleClick(e: { target: unknown }) {
		if (!node.contains(e.target as Node)) {
			onOutsideClick?.();
		}
	}

	return {
		destroy() {
			// the node has been removed from the DOM
			window.removeEventListener('click', handleClick);
		}
	};
}
