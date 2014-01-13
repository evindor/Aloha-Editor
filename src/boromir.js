/**
 * "One does not simply mutate the DOM" - Boromir
 *
 * Boromir - represent a DOM with immutable javascript data structures
 * (arrays and objects), transform the representation with functional
 * algorithms (no update in place), and efficiently update the DOM from
 * the transformed representation.
 *
 * Uses cases:
 *
 * present a normalized view (no empty text nodes, subsequent text nodes
 *   joined) (wouldn't call normalize() unnecessarily with a DOM
 *   representation),
 * 
 * shadow-dom - ignore shadow-dom/ephemera/non-visible elements for the
 *   purpose of the algorithm - whether or not ephemera/non-visible
 *   elements can be ignored completely depends on the algorithm - for
 *   example when inserting a node, does it matter whether it comes
 *   after or before a non-visible or ephemera node? - what is
 *   considered shadow DOM and what isn't is controllable,
 * 
 * inject ranges in the the content (wouldn't do it with the DOM,
 *   especially if the algorithm is read-only (read algorithms shouldn't
 *   mutate, otherwise composability is affected))
 * 
 * inject things like arrays into the content to allow a more convenient
 *   structure to be seen (wouldn't do it with the DOM, see above)
 * 
 * any mutate algorithms is also a read-only algorithm - apply a
 *   mutating algorithm and interpret the result without mutating the
 *   DOM directly (can clone the DOM and mutate the clone, but the
 *   mapping back to the DOM would be lost, also efficiency)
 * 
 * as-if algorithms - insert content into the tree without mutating the
 *   DOM, and apply algorithms as if the content was there, and
 *   interpret the results
 *
 * schema validation decoupled from algorithms (invalid DOM structure
 *   never inserted into the DOM, and multiple anti-violation strategies
 *   possible like don't mutate anything on violation, or automatically
 *   clean invalid nesting and try to preserve valid content).
 * 
 * immutable datastructure - functional programming - no suprising
 *   mutation effects in an algorithm (impossible with the DOM).
 * 
 * no surprises like walking up the ancestors - does your algorithm
 *   require to be attached to an editable, or not? dom nodes implicity
 *   carry around the context with them, which is fragile in practice
 *   (if I pass the dom node, what else do I really pass?).
 * 
 * read once, write once (otherwise, either within an algorithm, or even
 *   if an algorithm itself does read-once write-once, when composing
 *   multiple algoirthms, you'd have read multiple times, write multiple
 *   times)
 * 
 * optimal DOM updating (no split text node and re-insert, then split
 *   again reinsert and join and reinsert etc.)
 */
define(['dom', 'maps'], function (Dom, Maps) {
	'use strict';

	function assoc(map, key, value) {
		var merge = {};
		merge[key] = value;
		if (!map) {
			return merge;
		} 
		return Maps.merge(map, merge);
	}

	function clone(map) {
		return map && Maps.clone(map);
	}

	function attrs(domNode, modifiedAttrs) {
		return Maps.merge(modifiedAttrs, Maps.fillTuples({}, Dom.atts(domNode)));
	}

	// If we knew whether an element was inserted or removed, we could
	// make the DOM modification more efficient. Currently, only a
	// replaced node (or an equal number of subsequent inserts and
	// removes) is handled optimally. On the other hand, if a node was
	// either inserted or removed (but not an equal amount of both), all
	// following siblings would be replaced.
	//
	// We are assuming that orgChildren will still be appended to
	// domNode. If there were modifications to the dom, this may no
	// longer be the case and will cause an exception.
	function updateChildren(domNode, children, orgChildren, doc) {
		var len = orgChildren ? orgChildren.length : 0;
		var i = 0;
		children.forEach(function (child) {
			var newChildDomNode = child._updateDom(doc);
			if (i >= len) {
				domNode.appendChild(newChildDomNode);
			} else if (orgChildren[i]._domNode !== newChildDomNode) {
				domNode.replaceChild(newChildDomNode, orgChildren[i]._domNode);
			}
			i += 1;
		});
		for (; i < len; i++) {
			domNode.removeChild(orgChildren[i]._domNode);
		}
	}

	function Node() {
	}

	function Element(domElem, name, nameModified, attrs, modifiedAttrs, attrsReplaced, styles, modifiedStyles, children, originalChildren) {
		this._domNode = domElem;
		this._name = name;
		this._nameModified = nameModified;
		this._attrs = attrs;
		this._modifiedAtts = modifiedAttrs;
		this._attrsReplaced = attrsReplaced;
		this._styles = styles;
		this._modifiedStyles = modifiedStyles;
		this._children = children;
		this._originalChildren = originalChildren;
		this._isModified = null;
		this.type = 1;
	}
	Element.prototype = new Node();
	Element.prototype.children = function () {
		var children = this._children;
		if (!children) {
			children = this.originalChildren = this._children = Dom.children(this._domNode).map(fromDom);
		}
		return children;
	};
	Element.prototype.name = function () {
		var name = this._name;
		if (null == name) {
			name = this._name = this._domNode.nodeName;
		}
		return name;
	};
 	Element.prototype.attrs = function () {
		var attrs = this._attrs;
		if (!attrs) {
			attrs = this._attrs = attrs(this._domNode, this._modifiedAttrs);
		}
		return attrs;
	};
	Element.prototype.style = function (name) {
		var styles = this._styles;
		if (!styles) {
			styles = this._styles = {};
		}
		var value;
		if (styles.hasOwnProperty(name)) {
			value = styles[name];
		} else {
			value = styles[name] = Dom.getStyle(this._domNode, name);
		}
		return value;
	};
	Element.prototype.withName = function (name) {
		return new Element(
			this._domNode,
			name, true,
			this._attrs, this._modifiedAttrs, this._attrsReplaced,
			clone(this._styles), this._modifiedStyles,
			this._children, this._originalChildren
		);
	}
	Element.prototype.withAttr = function (name, value) {
		return new Element(
			this._domNode,
			this._name, this._nameModified,
			assoc(this._attrs, name, value), assoc(this._modifiedAttrs, name, value), this._attrsReplaced,
			clone(this._styles), this._modifiedStyles,
			this._children, this._originalChildren
		);
	};
	Element.prototype.replaceAttrs = function (attrs) {
		return new Element(
			this._domNode,
			this._name, this._nameModified,
			attrs, attrs, true,
			clone(this._styles), this._modifiedStyles,
			this._children, this._originalChildren
		);
	};
	Element.prototype.withStyle = function (name, value) {
		return new Element(
			this._domNode,
			this._name, this._nameModified,
			// TODO should modify the style attribute (or exclude the style attribute entirely from attributes?)
			this._attrs, this._modifiedAttrs, this._attrsReplaced,
			assoc(this._styles, name, value), assoc(this._modifiedStyles, name, value),
			this._children, this._originalChildren
		);
	};
	Element.prototype.withChildren = function (children) {
		return new Element(
			this._domNode,
			this._name, this._nameModified,
			this._attrs, this._modifiedAttrs, this._attrsReplaced,
			clone(this._styles), this._modifiedStyles,
			children, this._originalChildren
		);
	};
	Element.prototype.isModified = function () {
		var modified = this._isModified;
		if (null == modified) {
			modified = (this._nameModified
			            || this._modifiedAttrs
			            || this._attrsReplaced
			            || this._modifiedStyles
			            || (this._children
			                && (!this._originalChildren
			                    || !Arrays.isEqual(this._children, this._originalChildren)
			                    || Arrays.some(this._children, function (child) { return child.isModified(); }))));
			this._isModified = !!modified;
		}
		return modified;
	};
	Element.prototype.transformChildren = function (children) {
	};
	Element.prototype._updateDom = function (doc) {
		var domNode = this._domNode;
		var modified = this._isModified;
		if (null != modified && !modified && domNode) {
			return domNode;
		}
		var originalChildren = this._originalChildren;
		var children = this._children;
		if (this._nameModified || !domNode) {
			domNode = doc.createElement(this._name);
			// This is the only case (this.attr() and this.children())
			// where we must read from the DOM during update.
			Maps.forEach(this.attrs(), Fn.partial(Dom.setAttr, elem));
			originalChildren = this.children();
			children = children || originalChildren;
		}
		if (children) {
			updateChildren(domNode, children, originalChildren, doc);
		}
		if (this._attrsReplaced) {
			Dom.removeAttrs(domNode);
		}
		var attrs = this._modifiedAttrs;
		if (attrs) {
			Maps.forEach(attrs, Fn.partial(Dom.setAttr, domNode));
		}
		var styles = this._modifiedStyles;
		if (styles) {
			Maps.forEach(styles, Fn.partial(Dom.setStyle, domNode));
		}
		return domNode;
	};

	function Text(domNode, text, textModified) {
		this._domNode = domNode;
		this._text = text;
		this._textModified = textModified;
		this.type = 3;
	}
	Text.prototype = new Node();
	Text.prototype.text = function () {
		var text = this._text;
		if (null == text) {
			text = this._text = this._domNode.data;
		}
		return text;
	};
	Text.prototype.length = function () {
		return this.text().length;
	};
	Text.prototype.withText = function (text) {
		return new Text(this._domNode, text, true);
	};
	Text.prototype.isModified = function () {
		return this._textModified;
	};
	Text.prototype._updateDom = function (doc) {
		var domNode = this._domNode;
		var text = this._text;
		if (!domNode) {
			domNode = doc.createTextNode(text);
		} else if (this._textModified) {
			domNode.data = text;
		}
		return domNode;
	};

	function Any(domNode) {
		this._domNode = domNode;
		this.type = domNode.nodeType;
	}
	Any.prototype = new Node();
	Any.prototype.isModified = function () {
		return false;
	};
	Any.prototype._updateDom = function (doc) {
		return this._domNode;
	};

	function fromDom(domNode) {
		return (Dom.isElement(domNode)
		        ? new Element(domNode)
		        (Dom.isTextNode(domNode)
		         ? new Text(domNode)
		         : new Any(domNode)));
	}

	function coerce(maybeDom) {
		return maybeDom._domNode ? maybeDom : fromDom(maybeDom);
	}

	function updateDom(doc, node) {
		return node._updateDom(doc);
	}

	function updateReplaceDom(domNode, node) {
		var newDomNode = updateDom(domNode.ownerDocument, node);
		if (newDomNode !== domNode) {
			var parent = domNode.parentNode;
			if (parent) {
				parent.replaceChild(newDomNode, domNode);
			}
		}
	}

	function createElement(name, attrs) {
		return new Element(null, name, attrs);
	}

	function createText(text) {
		return new Text(null, text);
	}

	return {
		fromDom: fromDom,
		coerce: coerce,
		updateDom: updateDom,
		udpateReplaceDom: updateReplaceDom,
		createElement: createElement,
		createText: createText
	};
});
