import React from 'react';

const IcaoInput = ({ icaoInput, setIcaoInput, handleIcaoSubmit, icaoListExpanded, setIcaoListExpanded }) => {
  return (
    <div className="glass p-4 flex flex-col sm:flex-row items-center gap-4 mb-4">
      <form onSubmit={handleIcaoSubmit} className="flex flex-wrap items-center gap-3 w-full">
        <input
          value={icaoInput}
          onChange={(e) => setIcaoInput(e.target.value)}
          className="px-4 py-2 rounded-lg bg-[#21263b] border border-[#283057] text-lg outline-cyan-300 font-mono tracking-widest w-56 uppercase"
          maxLength="60"
          placeholder="ICAO (comma separated)"
          spellCheck="false"
        />
        <button
          type="submit"
          className="bg-cyan-500 hover:bg-cyan-400 px-4 py-2 rounded-lg font-bold text-[#131926] transition shadow"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => setIcaoListExpanded(!icaoListExpanded)}
          style={{
            marginLeft: 'auto',
            fontSize: '1.3em',
            padding: '0.1em 0.9em',
            borderRadius: '1em',
            background: '#18213b',
            color: '#67e8f9',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          {icaoListExpanded ? '⯆' : '⯈'}
        </button>
      </form>
    </div>
  );
};

export default IcaoInput;