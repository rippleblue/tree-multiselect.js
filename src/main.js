var Option = require('./option');
var Tree = require('./tree');
var UiBuilder = require('./ui-builder');
var Util = require('./utility');

var treeMultiselect = function(opts) {
  var options = mergeDefaultOptions(opts);
  this.each(() => {
    var $originalSelect = $(this);
    $originalSelect.attr('multiple', '').css('display', 'none');

    var uiBuilder = new UiBuilder($originalSelect, options.hideSidePanel);

    var tree = new Tree($originalSelect, uiBuilder.$selectionContainer, uiBuilder.$selectedContainer, options);
    tree.initialize();

    var $selectionContainer = uiBuilder.$selectionContainer;

    if (options.collapsible) {
      addCollapsibility($selectionContainer, options);
    }

    if (options.enableSelectAll) {
      createSelectAllButtons($selectionContainer, options);
    }

    var $selectedContainer = uiBuilder.$selectedContainer;
    updateSelectedAndOnChange($selectionContainer, $selectedContainer, $originalSelect, options);
    armRemoveSelectedOnClick($selectionContainer, $selectedContainer, options);
  });

  return this;
};

function mergeDefaultOptions(options) {
  var defaults = {
    allowBatchSelection: true,
    collapsible: true,
    enableSelectAll: false,
    selectAllText: 'Select All',
    unselectAllText: 'Unselect All',
    freeze: false,
    hideSidePanel: false,
    onChange: null,
    onlyBatchSelection: false,
    sectionDelimiter: '/',
    showSectionOnSelected: true,
    sortable: false,
    startCollapsed: false
  };
  return $.extend({}, defaults, options);
}

function addCollapsibility($selectionContainer, options) {
  var hideIndicator = "-";
  var expandIndicator = "+";

  var titleSelector = "div.title";
  var $titleDivs = $selectionContainer.find(titleSelector);

  var collapseDiv = document.createElement('span');
  collapseDiv.className = "collapse-section";
  if (options.startCollapsed) {
    $(collapseDiv).text(expandIndicator);
    $titleDivs.siblings().toggle();
  } else {
    $(collapseDiv).text(hideIndicator);
  }
  $titleDivs.prepend(collapseDiv);

  $selectionContainer.on("click", titleSelector, function(event) {
    if (event.target.nodeName == "INPUT") {
      return;
    }
    var $collapseSection = $(this).find("> span.collapse-section");
    var indicator = $collapseSection.text();
    $collapseSection.text(indicator ==  hideIndicator ? expandIndicator : hideIndicator);
    var $title = $collapseSection.parent();
    $title.siblings().toggle();
  });
}

function createSelectAllButtons($selectionContainer, options) {
  var $selectAll = $("<span class='select-all'></span>");
  $selectAll.text(options.selectAllText);
  var $unselectAll = $("<span class='unselect-all'></span>");
  $unselectAll.text(options.unselectAllText);

  var $selectAllContainer = $("<div class='select-all-container'></div>");

  $selectAllContainer.prepend($unselectAll);
  $selectAllContainer.prepend($selectAll);

  $selectionContainer.prepend($selectAllContainer);

  $selectionContainer.on("click", "span.select-all", function() {
    handleCheckboxes(true);
  });

  $selectionContainer.on("click", "span.unselect-all", function() {
    handleCheckboxes(false);
  });

  function handleCheckboxes(checked) {
    var $checkboxes = $selectionContainer.find("input[type=checkbox]");
    $checkboxes.prop('checked', checked);
    $checkboxes.first().change();
  }
}

function updateSelectedAndOnChange($selectionContainer, $selectedContainer, $originalSelect, options) {
  function createSelectedDiv(selection) {
    var text = selection.text;
    var value = selection.value;
    var sectionName = selection.sectionName;

    var item = document.createElement('div');
    item.className = "item";
    item.innerHTML = text;

    if (options.showSectionOnSelected) {
      var $sectionSpan = $("<span class='section-name'></span>");
      $sectionSpan.text(sectionName);
      $(item).append($sectionSpan);
    }

    if (!options.freeze) {
      $(item).prepend("<span class='remove-selected'>×</span>");
    }

    $(item).attr('data-value', value)
      .appendTo($selectedContainer);
  }

  function addNewFromSelected(selections) {
    var currentSelections = [];
    $selectedContainer.find("div.item").each(function() {
      currentSelections.push($(this).attr('data-value'));
    });

    var selectionsNotYetAdded = selections.filter(function(selection) {
      return currentSelections.indexOf(selection.value) == -1;
    });

    selectionsNotYetAdded.forEach(function(selection) {
      createSelectedDiv(selection);
    });

    armRemoveSelectedOnClick($selectionContainer, $selectedContainer);

    return selectionsNotYetAdded;
  }

  function removeOldFromSelected(selections) {
    var selectionTexts = [];
    selections.forEach(function(selection) {
      selectionTexts.push(selection.value);
    });

    var removedValues = [];

    $selectedContainer.find("div.item").each(function(index, el) {
      var $item = $(el);
      var value = $item.attr('data-value');
      if (selectionTexts.indexOf(value) == -1) {
        removedValues.push(value);
        $item.remove();
      }
    });

    var unselectedSelections = [];
    var allSelections = $selectionContainer.find("div.item");
    allSelections.each(function() {
      var $this = $(this);
      if (removedValues.indexOf($this.attr('data-value')) !== -1) {
        unselectedSelections.push(elToSelectionObject($this));
      }
    });
    return unselectedSelections;
  }

  function elToSelectionObject($el) {
    var text = Util.textOf($el);
    var value = $el.attr('data-value');
    var initialIndex = $el.attr('data-index');
    $el.attr('data-index', undefined);

    var sectionName = $.map($el.parentsUntil($selectionContainer, "div.section").get().reverse(), function(parentSection) {
      return Util.textOf($(parentSection).find("> div.title"));
    }).join(options.sectionDelimiter);

    return {
      text: text,
      value: value,
      initialIndex: initialIndex,
      sectionName: sectionName
    };
  }

  function updateOriginalSelect() {
    var selected = [];
    $selectedContainer.find("div.item").each(function() {
      selected.push($(this).attr('data-value'));
    });

    $originalSelect.val(selected).change();

    $originalSelect.html($originalSelect.find("option").sort(function(a, b) {
      var aValue = selected.indexOf($(a).attr('value'));
      var bValue = selected.indexOf($(b).attr('value'));

      if (aValue > bValue) return 1;
      if (aValue < bValue) return -1;
      return 0;
    }));
  }

  var initialRun = true;
  function update() {
    var $selectedBoxes = $selectionContainer.find("div.item").has("> input[type=checkbox]:checked");
    var selections = [];

    $selectedBoxes.each(function() {
      var $el = $(this);
      selections.push(elToSelectionObject($el));
    });

    selections.sort(function(a, b) {
      var aIndex = parseInt(a.initialIndex);
      var bIndex = parseInt(b.initialIndex);
      if (aIndex > bIndex) return 1;
      if (aIndex < bIndex) return -1;
      return 0;
    });

    var newlyAddedSelections = addNewFromSelected(selections);
    var newlyRemovedSelections = removeOldFromSelected(selections);
    updateOriginalSelect();

    if (initialRun) {
      initialRun = false;
    } else if (options.onChange) {
      options.onChange(selections, newlyAddedSelections, newlyRemovedSelections);
    }

    if (options.sortable && !options.freeze) {
      $selectedContainer.sortable({
        update: function(event, ui) {
          updateOriginalSelect();
        }
      });
    }
  }

  Util.onCheckboxChange($selectionContainer, update);
}

function armRemoveSelectedOnClick($selectionContainer, $selectedContainer) {
  $selectedContainer.on("click", "span.remove-selected", function() {
    var parentNode = this.parentNode;
    var value = parentNode.attributes.getNamedItem('data-value').value;
    var $matchingSelection = $selectionContainer.find("div.item[data-value='" + value + "']");
    var $matchingCheckbox = $matchingSelection.find("> input[type=checkbox]");
    $matchingCheckbox.prop('checked', false);
    $matchingCheckbox.change();
  });
}

module.exports = treeMultiselect;