import { useState, useEffect } from 'react';

export const useIcaoSets = (icaoSet) => {
  const [icaoSets, setIcaoSets] = useState([]);
  const [showIcaoSetsModal, setShowIcaoSetsModal] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [showSaveSetModal, setShowSaveSetModal] = useState(false);
  const [pendingNewSetAction, setPendingNewSetAction] = useState(false);

  // Load saved ICAO sets
  useEffect(() => {
    const savedSets = getIcaoSets();
    setIcaoSets(savedSets);
  }, []);

  const getIcaoSets = () => {
    return JSON.parse(localStorage.getItem('icaoSets') || '[]');
  };

  const saveIcaoSets = (sets) => {
    localStorage.setItem('icaoSets', JSON.stringify(sets));
    setIcaoSets(sets);
  };

  const createIcaoSet = () => {
    if (!newSetName.trim() || icaoSet.length === 0) return;
    const sets = getIcaoSets();
    const newSet = {
      name: newSetName.trim(),
      icaos: [...icaoSet],
      created: new Date().toISOString()
    };
    sets.push(newSet);
    saveIcaoSets(sets);
    setNewSetName('');
    setShowIcaoSetsModal(false);
    
    // If this was from the "New Set" flow, continue with clearing
    if (pendingNewSetAction) {
      setPendingNewSetAction(false);
      return true; // Signal to clear the current set
    }
    return false;
  };

  const deleteIcaoSet = (index) => {
    const sets = getIcaoSets();
    sets.splice(index, 1);
    saveIcaoSets(sets);
  };

  const isCurrentSetSaved = () => {
    return icaoSets.some(set => 
      set.icaos.length === icaoSet.length && 
      set.icaos.every(icao => icaoSet.includes(icao))
    );
  };

  const handleNewSetClick = () => {
    if (icaoSet.length === 0) {
      return false; // Focus the input instead
    }
    
    // Check if current set is already saved
    if (!isCurrentSetSaved()) {
      // Show custom save prompt
      setShowSaveSetModal(true);
      setPendingNewSetAction(true);
      return false; // Don't clear yet
    } else {
      // If already saved, go ahead and create new set
      return true; // Signal to clear the current set
    }
  };

  const handleSaveSetResponse = (shouldSave) => {
    setShowSaveSetModal(false);
    
    if (shouldSave) {
      // Open the ICAO Sets modal to save
      setShowIcaoSetsModal(true);
      return false; // Don't clear yet
    } else if (pendingNewSetAction) {
      // If was creating a new set, proceed with that
      setPendingNewSetAction(false);
      return true; // Signal to clear the current set
    }
    return false;
  };

  return {
    icaoSets,
    showIcaoSetsModal,
    newSetName,
    showSaveSetModal,
    pendingNewSetAction,
    setShowIcaoSetsModal,
    setNewSetName,
    setShowSaveSetModal,
    setPendingNewSetAction,
    getIcaoSets,
    saveIcaoSets,
    createIcaoSet,
    deleteIcaoSet,
    handleNewSetClick,
    handleSaveSetResponse,
    isCurrentSetSaved
  };
};