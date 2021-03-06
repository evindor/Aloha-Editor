(function (aloha) {
	'use strict';

	var Xhtml = aloha.xhtml;
	var Boundaries = aloha.boundaries;
	var BoundaryMarkers = aloha.boundarymarkers;

	module('boundarymarkers');

	test('insert', function () {
		var $dom = $('<p><b>abc</b><i>xyz</i></p>');
		var start = Boundaries.create($dom.find('b')[0].firstChild, 1);
		var end = Boundaries.create($dom.find('i')[0], 0);
		var boundaries = BoundaryMarkers.insert(start, end);
		equal(
			Boundaries.commonContainer(boundaries[0], boundaries[1]).outerHTML,
			'<p><b>a[bc</b><i>}xyz</i></p>'
		);
	});

	test('extract', function () {
		var boundaries = BoundaryMarkers.extract($('<p><b>a[bc</b><i>}xyz</i></p>')[0]);
		var start = Boundaries.container(boundaries[0]);
		var end = Boundaries.container(boundaries[1]);
		var common = Boundaries.commonContainer(boundaries[0], boundaries[1]);
		equal(common.nodeName, 'P');
		equal(start.nodeType, aloha.dom.Nodes.TEXT);
		equal(end.nodeName, 'I');
	});

	test('hint', function () {
		(function t(before, after) {
			var boundaries = BoundaryMarkers.extract($(before)[0]);
			equal(
				BoundaryMarkers.hint(boundaries).replace(/ xmlns=['"][^'"]*['"]/, ''),
				after,
				before + ' ⇒ ' + after
			);
			return t;
		})
		('<p>x[y]z</p>',        '<p>x[y]z</p>')
		('<p>x[yz]</p>',        '<p>x[yz]</p>')
		('<p>[xyz]</p>',        '<p>[xyz]</p>')
		('<p>x{<b>y</b>}z</p>', '<p>x{<b>y</b>}z</p>')
		('<p>x{<b>y}</b>z</p>', '<p>x{<b>y}</b>z</p>')
		('<p>x<b>{y</b>}z</p>', '<p>x<b>{y</b>}z</p>')
		('<p>x<b>{y}</b>z</p>', '<p>x<b>{y}</b>z</p>');

		equal(
			BoundaryMarkers.hint(Boundaries.fromEndOfNode($('<p>x</p>')[0])),
			'<p>x|</p>'
		);

		equal(
			BoundaryMarkers.hint(Boundaries.fromEndOfNode($('<p>x</p>')[0].firstChild)),
			'<p>x¦</p>'
		);
	});

	test('insert,extract', function () {
		(function t(markup) {
			var dom = $(markup)[0];
			var stripped = markup.replace(/[\[\{\}\]]/g, '');
			var boundaries = BoundaryMarkers.extract(dom);
			equal(Xhtml.nodeToXhtml(dom), stripped, markup + ' ⇒  ' + stripped);
			BoundaryMarkers.insert(boundaries[0], boundaries[1]);
			equal(Xhtml.nodeToXhtml(dom), markup, stripped + ' ⇒  ' + markup);
			return t;
		})
		('<p>{Some text.}</p>')
		('<p>Some{ }text.</p>')
		('<p>{}Some text.</p>')
		('<p>Some text.{}</p>')
		('<p>Som{}e text.</p>')
		('<p>{<b>Some text.</b>}</p>')
		('<p>12{34<b>Some text.</b>56}78</p>')
		('<p>{1234<b>Some text.</b>5678}</p>')
		('<p>1234{<b>Some text.</b>}5678</p>');
	});

}(window.aloha));
