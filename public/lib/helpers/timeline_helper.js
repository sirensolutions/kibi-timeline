define(function (require) {
  const _ = require('lodash');
  const kibiUtils = require('kibiutils');
  const moment = require('moment');

  return function TimelineHelperFactory() {
    function TimelineHelper() {
    }

    TimelineHelper.prototype.noEndOrEqual = function (startValue, endValue) {
      return !endValue || startValue === endValue ? true : false;
    };

    TimelineHelper.prototype.createItemTemplate = function (itemDict) {
      let endfield = '';
      let dot = '';
      let hilit = '';
      let label = itemDict.labelValue;

      if (itemDict.endField) {
        endfield = `, endField: ${itemDict.endField}`;
      }
      if (this.noEndOrEqual(itemDict.startValue, itemDict.endValue)) {
        dot = `<div class="kibi-tl-dot-item" style="border-color:${itemDict.groupColor}"></div>`;
        label = `<div class="kibi-tl-label-item">${itemDict.labelValue}</div>`;
      }
      if (itemDict.useHighlight) {
        hilit = `<p class="tiny-txt">${itemDict.highlight}</p>`;
      }

      return `<div title="index: ${itemDict.indexId}, startField: ${itemDict.startField}${endfield}">` +
          `${dot}${label}${hilit}</div>`;
    };

    TimelineHelper.prototype.isMultifield  = function (str) {
      if (str.indexOf('.') > -1) {
        return true;
      } else {
        return false;
      }
    };

    TimelineHelper.prototype.changeTimezone  = function (timezone) {
      if (timezone !== 'Browser') {
        return moment().tz(timezone).format('Z');
      } else {
        return timezone;
      }
    };

    /**
     * pluckLabel returns the label of an event
     *
     * @param hit the document of the event
     * @param params configuration parameters for the event
     * @param notify object for user notification
     * @returns the label as a string
     */
    TimelineHelper.prototype.pluckLabel = function (hit, params, notify) {
      let field;
      if (params.labelFieldSequence) { // in kibi, we have the path property of a field
        if (this.isMultifield(params.labelFieldSequence[0])) {
          field = kibiUtils.getValuesAtPath(hit.fields, params.labelFieldSequence);
        } else {
          field = kibiUtils.getValuesAtPath(hit._source, params.labelFieldSequence);
        }
      } else {
        field = _.get(hit._source, params.labelField);
      }

      if (field && (!_.isArray(field) || field.length)) {
        return field;
      }
      return 'N/A';
    };

    /**
     * pluckHighlights returns the highlighted terms for the event.
     * The terms are sorted first on the number of occurrences of a term, and then alphabetically.
     *
     * @param hit the event
     * @param highlightTags the tags that wrap the term
     * @returns a comma-separated string of the highlighted terms and their number of occurrences
     */
    TimelineHelper.prototype.pluckHighlights = function (hit, highlightTags) {
      if (!hit.highlight) {
        return '';
      }

      //Track unique highlights, count number of times highlight occurs.
      const counts = new Map(); //key is highlight tag, value is count
      Object.keys(hit.highlight).forEach(function (key) {
        hit.highlight[key].forEach(function (it) {
          const fragment = extractFragment(it, highlightTags.pre, highlightTags.post);
          if (counts.has(fragment)) {
            counts.set(fragment, counts.get(fragment) + 1);
          } else {
            counts.set(fragment, 1);
          }
        });
      });

      return Array.from(counts.keys())
      .sort(function (a, b) {
        //same count, return alphabetic order
        if (counts.get(a) === counts.get(b)) {
          return a > b;
        }
        //return count order
        return counts.get(a) < counts.get(b);
      })
      .map(key => `${key}: ${counts.get(key)}`)
      .join(', ');
    };

    function extractFragment(highlightedElement, openTag, closeTag) {
      const openIndex = highlightedElement.indexOf(openTag);
      const closeIndex = highlightedElement.indexOf(closeTag);
      return highlightedElement.substring(openIndex + openTag.length, closeIndex).toLowerCase().trim();
    }

    /**
     * Creates an Elasticsearch sort object to sort in chronological order
     *
     * @param params group configuraton parameters
     * @returns Elasticsearch sort object
     */
    TimelineHelper.prototype.getSortOnStartFieldObject = function (params) {
      const sortObj = {};
      if (params.startFieldSequence) {
        sortObj[params.startFieldSequence.join('.')] = { order: 'asc' };
      } else {
        sortObj[params.startField] = { order: 'asc' };
      }
      return sortObj;
    };

    return new TimelineHelper();
  };
});
