pageCanvas.setConfig(
  { onSelect: function ( elem ) {
        var
        g = $(elem).closest('g'),
        char_warn = g.find('.TextEquiv > .Property[key=warn-char]'),
        text = g.find('> .TextEquiv > .Unicode');
        if ( text.length !== 0 )
          text = pageCanvas.cfg.textFormatter(text.html());

        if ( text && char_warn.length > 0 ) {
          char_warn = char_warn.attr('value').split(' ');
          text = text.split(/(<[^<>]+>)/g).map(x => /<[^<>]+>/.test(x) ? x : x.split('')).flat();
          text.unshift(' ');
          text.push(' ');

          if ( char_warn.length != text.length ) {
            console.log('Skipping char warning display due to length differences');
            console.log(char_warn);
            console.log(text);
          }
          else {
            warn_div = $(document.createElement('div'))
            for (var n=0; n<text.length; n++) {
              var warn_char = $(document.createElement('span'))
                .attr('class', 'warn-'+char_warn[n])
                .appendTo(warn_div);
              if ( text[n] == ' ' )
                warn_char.html('&nbsp;');
              else
                warn_char.text(text[n]);
            }
            warn_div.prependTo('#textinfo');
          }
        }
      }
  } );
