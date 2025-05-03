export const ConsumptionLog = () => {
  return (
    <pre>
      {`
        CONSUMPTION LOG
        ----------------------------------------
        ◄ MAY 2025 ►

        [03] TODAY - $37.25
        [02] YESTERDAY - $42.10 
        [01] THURSDAY - $28.50
        [30] WEDNESDAY - $31.75
        [29] TUESDAY - $45.00

        [CLICK TO EXPAND DAY]
        ----------------------------------------
        ▼ 05/03/2025 - FRIDAY                    
        ----------------------------------------
        [08:30] Coffee + Croissant     $6.50
        [12:15] Sandwich + Chips       $12.00
        [19:00] Pasta Dinner          $18.75
        ----------------------------------------
        TOTAL SPENT: $37.25
        BUDGET USED: [████████░░] 75%
      `}
    </pre>
  );
};
