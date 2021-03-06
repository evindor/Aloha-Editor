/**
 * transform/utils.js is part of Aloha Editor project http://aloha-editor.org
 *
 * Aloha Editor is a WYSIWYG HTML5 inline editing library and editor.
 * Copyright (c) 2010-2014 Gentics Software GmbH, Vienna, Austria.
 * Contributors http://aloha-editor.org/contribution.php
 */
define([
	'dom',
	'functions',
	'html',
	'arrays',
	'content'
], function (
	Dom,
	Fn,
	Html,
	Arrays,
	Content
) {
	'use strict';

	/**
	 * @TODO Use editable configuration.
	 */
	var DEFAULT_BLOCK_ELEMENT = 'p';

	var blacklist = Content.NODES_BLACKLIST.reduce(function (map, item) {
		map[item] = true;
		return map;
	}, {});

	function isBlacklisted(node) {
		return blacklist[node.nodeName];
	}

	/**
	 * Given a list of nodes, will wrap consecutive nodes that return true for
	 * `pred` into a `wrapper` nodes.
	 *
	 * @private
	 * @param  {Arrays.<Nodes>}         nodes
	 * @param  {function(Node):boolean} pred
	 * @param  {string}                 wrapper
	 * @return {Array.<Nodes>}
	 */
	function wrapSublists(nodes, pred, wrapper) {
		var elements = [];
		var wrapplings;
		var l = nodes.length;
		var i;
		for (i = 0; i < l; i++) {
			wrapplings = [];
			while (i < l && pred(nodes[i])) {
				wrapplings.push(nodes[i]);
				i++;
			}
			if (wrapplings.length > 0) {
				elements.push(wrapplings[0].ownerDocument.createElement(wrapper));
				Dom.move(wrapplings, Arrays.last(elements));
			}
			if (i < l) {
				elements.push(nodes[i]);
			}
		}
		return elements;
	}

	/**
	 * Checks whether this node should is visible.
	 *
	 * @private
	 * @param  {Node} node
	 * @return {boolean}
	 */
	function isRendered(node) {
		if (Html.isRendered(node)) {
			return !Dom.isElementNode(node)
			    || Dom.getStyle(node, 'display') !== 'none';
		}
		return false;
	}

	/**
	 * Reduces the given list of nodes into a list of cleaned nodes.
	 *
	 * @private
	 * @param  {Array.<Node>}                nodes
	 * @param  {function(Node):Array.<Node>} clean
	 * @param  {function():Node}             normalize
	 * @return {Array.<Node>}
	 */
	function cleanNodes(nodes, clean, normalize) {
		var allowed = nodes.filter(Fn.complement(isBlacklisted));
		var rendered = allowed.filter(isRendered);
		return rendered.reduce(function (nodes, node) {
			clean(node).forEach(function (node) {
				nodes = nodes.concat(normalize(node, clean));
			});
			return nodes;
		}, []);
	}

	/**
	 * Removes redundant nested blocks in the given list of nodes.
	 *
	 * Example:
	 * <div><div><p>The 2 outer divs are reduntant</p></div></div>
	 * <div><p>This outer div is also reduntant</p></div>
	 *
	 * @private
	 * @param  {Array.<Node>} nodes
	 * @return {Array.<Node>}
	 */
	function removeRedundantNesting(nodes) {
		return nodes.reduce(function (nodes, node) {
			var kids = Dom.children(node);
			if (1 === kids.length && Html.hasLinebreakingStyle(kids[0])) {
				if (Html.isGroupedElement(node)) {
					if (!Html.isGroupContainer(kids[0])) {
						Dom.removeShallow(kids[0]);
					}
				} else if (!Html.isGroupContainer(node) && Html.hasLinebreakingStyle(node)) {
					node = kids[0];
				}
			}
			var copy = Dom.cloneShallow(node);
			Dom.move(removeRedundantNesting(Dom.children(node)), copy);
			return nodes.concat(copy);
		}, []);
	}

	/**
	 * Recursively cleans the given node and it's children according to the
	 * given clean function.
	 *
	 * @private
	 * @param  {Node}                        node
	 * @param  {function(Node):Array.<Node>} clean
	 * @return {Array.<Node>}
	 */
	function cleanNode(node, clean) {
		return clean(node).reduce(function (nodes, node) {
			var children = cleanNodes(Dom.children(node), clean, cleanNode);
			if ('DIV' === node.nodeName) {
				children = wrapSublists(
					children,
					Html.isInlineNode,
					DEFAULT_BLOCK_ELEMENT
				);
			}
			var copy = Dom.cloneShallow(node);
			Dom.move(removeRedundantNesting(children), copy);
			return nodes.concat(copy);
		}, []);
	}

	/**
	 * Creates a rewrapped copy of `element`. Will create a an element based on
	 * `nodeName`, and copies the content of the given element into it.
	 *
	 * @param  {Element} element
	 * @param  {String}  nodeName
	 * @return {Element}
	 */
	function rewrap(element, nodeName) {
		var wrapper = element.ownerDocument.createElement(nodeName);
		Dom.move(Dom.children(Dom.clone(element)), wrapper);
		return wrapper;
	}

	/**
	 * Normalizes the given node tree and returns a fragment.
	 *
	 * @param  {Element}             element
	 * @param  {function(Node):Node} clean
	 * @return {Fragment}
	 */
	function normalize(element, clean) {
		var fragment = element.ownerDocument.createDocumentFragment();
		Dom.move(cleanNode(element, clean), fragment);
		return fragment;
	}

	/**
	 * Extracts body content if the content is an HTML page. Otherwise it
	 * returns the content itself.
	 *
	 * @fixme
	 * What if `content` contains a comment like this:
	 * <html><!-- <body>gotcha!</body> --><title>woops</title><body>hello, world!</body></html>
	 *
	 * @param  {string} markup
	 * @return {string}
	 */
	function extract(markup) {
		markup = markup.replace(/\n/g, ' ');
		markup = markup.replace(/<iframe.*?<\/iframe>/g, '');
		var start = /<body.*?>/i.exec(markup);
		var end = /<\/body.*?>/i.exec(markup);
		if (start && end) {
			var index = markup.indexOf(start[0]) + start[0].length;
			var lastIndex = markup.indexOf(end[0]);
			return markup.slice(index, lastIndex);
		}
		return markup;
	}

	return {
		normalize : normalize,
		extract   : extract,
		rewrap    : rewrap
	};
});
