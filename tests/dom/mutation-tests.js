(function (aloha) {
	'use strict';

	var Dom = aloha.dom;
	var Mutation = aloha.mutation;

	module('dom');

	test('splitTextNode', function () {
		var node = $('<div>foo<b>bar</b></div>')[0];
		var range = aloha.ranges.create(
			node.firstChild,
			1,
			node.lastChild.lastChild,
			2
		);
		Mutation.splitTextContainers(range);
		equal(node.childNodes[0].data, 'f');
		equal(node.childNodes[1].data, 'oo');
		equal(node.lastChild.childNodes[0].data, 'ba');
		equal(node.lastChild.childNodes[1].data, 'r');
	});

	test('splitBoundary', function () {
		var node = $('<div>foo<b>bar</b></div>')[0];
		var range = aloha.ranges.create(
			node.firstChild,
			2,
			node.lastChild.lastChild,
			2
		);
		Mutation.splitBoundary([node.firstChild, 1], [range]);
		equal(
			Dom.nodeAtOffset(range.startContainer, range.startOffset).data,
			'oo'
		);
	});

	test('joinTextNodeAdjustRange', function () {
		var node = $('<div>foo<b>bar</b></div>')[0];
		Mutation.splitTextNode(node.firstChild, 2);
		var range = aloha.ranges.create(
			node.childNodes[1],
			0,
			node.lastChild.lastChild,
			2
		);
		Mutation.joinTextNodeAdjustRange(node.firstChild, range);
		equal(
			Dom.nodeAtOffset(range.startContainer, range.startOffset).data,
			'foo'
		);
	});

	test('removeShallowPreservingBoundariesCursors', function () {
		var node = $('<div><span><b>foo</b></span></div>')[0];
		var points = [
			aloha.cursors.cursorFromBoundaryPoint(node, 0),
			aloha.cursors.cursorFromBoundaryPoint(node.firstChild, 1)
		];
		Mutation.removeShallowPreservingCursors(node.firstChild, points);
		equal(node.outerHTML, '<div><b>foo</b></div>');
		equal(points[0].node.nodeName, 'B');
		equal(points[0].atEnd, false);
		equal(points[1].node.nodeName, 'DIV');
		equal(points[1].atEnd, true);
	});

	test('removePreservingRange', function () {
		var node = $('<div><span>foo<b>bar</b></span></div>')[0];
		var range = aloha.ranges.create(node, 0, node.firstChild.lastChild, 1);

		Mutation.removePreservingRange(node.firstChild.lastChild, range);
		equal(node.outerHTML, '<div><span>foo</span></div>');
		equal(range.startContainer.nodeName, 'DIV');
		equal(range.startOffset, 0);
		equal(range.endContainer.nodeName, 'SPAN');
		equal(range.endOffset, 1);

		Mutation.removePreservingRanges(node.firstChild.firstChild, [range]);
		equal(node.outerHTML, '<div><span></span></div>');
		equal(range.startContainer.nodeName, 'DIV');
		equal(range.startOffset, 0);
		equal(range.endContainer.nodeName, 'SPAN');
		equal(range.endOffset, 0);
	});

}(window.aloha));
