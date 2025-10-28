function attachQuickLinkDragHandlers(container) {
    if (!container) {
        return;
    }

    if (!quickLinkContainerListenersAttached) {
        container.addEventListener('dragover', handleQuickLinksContainerDragOver);
        container.addEventListener('drop', handleQuickLinksContainerDrop);
        quickLinkContainerListenersAttached = true;
    }
}

function handleQuickLinkDragStart(event) {
    const target = event.currentTarget;
    draggedQuickLinkId = target.dataset.linkId || null;
    draggedQuickLinkElement = target;
    target.classList.add('dragging');

    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', draggedQuickLinkId || '');
    }
}

function handleQuickLinkDragEnter(event) {
    if (!draggedQuickLinkId || !draggedQuickLinkElement) {
        return;
    }

    const target = event.currentTarget;
    if (target.dataset.linkId === draggedQuickLinkId) {
        return;
    }

    // Immediately reorder in DOM for smooth animation
    const container = target.parentElement;
    if (!container || !container.contains(draggedQuickLinkElement)) {
        return;
    }

    const allLinks = Array.from(container.querySelectorAll('.quick-link'));
    const draggedIndex = allLinks.indexOf(draggedQuickLinkElement);
    const targetIndex = allLinks.indexOf(target);

    if (draggedIndex === -1 || targetIndex === -1) {
        return;
    }

    // Insert before or after based on direction
    if (draggedIndex < targetIndex) {
        container.insertBefore(draggedQuickLinkElement, target.nextSibling);
    } else {
        container.insertBefore(draggedQuickLinkElement, target);
    }
}

function handleQuickLinkDragOverItem(event) {
    if (!draggedQuickLinkId) {
        return;
    }

    const target = event.currentTarget;
    if (target.dataset.linkId === draggedQuickLinkId) {
        return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
    }
}

function handleQuickLinkDragLeave(event) {
    // No need to show drag-over state since we're repositioning live
}

function handleQuickLinkDropOnItem(event) {
    if (!draggedQuickLinkId) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();

    const container = event.currentTarget.parentElement;
    if (!container) {
        return;
    }

    persistQuickLinkOrder(container);
}

function handleQuickLinksContainerDragOver(event) {
    if (!draggedQuickLinkId) {
        return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
    }
}

function handleQuickLinksContainerDrop(event) {
    if (!draggedQuickLinkId) {
        return;
    }

    event.preventDefault();

    const container = event.currentTarget;
    persistQuickLinkOrder(container);
}

function performQuickLinkDrop(container, referenceElement, event) {
    // This function is no longer needed with live reordering
    // Keeping for potential future use
}

function findClosestQuickLink(container, x, y) {
    // No longer needed with live reordering
    // Keeping for potential future use
}

function persistQuickLinkOrder(container) {
    const orderedIds = Array.from(container.querySelectorAll('.quick-link'))
        .map((element) => element.dataset.linkId)
        .filter(Boolean);

    const existingLinks = getQuickLinks();
    const linkById = new Map(existingLinks.map((link) => [link.id, link]));
    const reorderedLinks = orderedIds
        .map((id) => linkById.get(id))
        .filter(Boolean);

    if (reorderedLinks.length !== existingLinks.length) {
        resetQuickLinkDragState();
        loadQuickLinks();
        return;
    }

    saveQuickLinks(reorderedLinks);
    resetQuickLinkDragState();
}

function handleQuickLinkDragEnd(event) {
    event.currentTarget.classList.remove('dragging');
    event.currentTarget.classList.remove('drag-over');
    resetQuickLinkDragState();
}

function resetQuickLinkDragState() {
    draggedQuickLinkId = null;
    draggedQuickLinkElement = null;

    const container = document.getElementById('quickLinksContainer');
    if (!container) {
        return;
    }

    container.querySelectorAll('.quick-link.drag-over').forEach((element) => {
        element.classList.remove('drag-over');
    });
}

