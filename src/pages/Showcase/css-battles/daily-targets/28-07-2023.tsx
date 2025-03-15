export const DailyTargets_28072023 = () => {
  return (
    <div className="bg-[#F7EC7D] relative w-full h-full">
      <div className="w-[400px] h-[300px] justify-center">
        <div className="absolute bg-[#62306D] w-full h-[50%] bottom-0 left-0 right-0" />
        <div className="absolute bg-[#62306D] w-[150px] h-[150px] left-0 rounded-full" style={{ top: 'calc(50% - 75px)' }} />
        <div
          className="absolute bg-[#F7EC7D] h-[100px] left-[150px] rounded-full"
          style={{ width: 'calc(100% - 300px)', top: 'calc(50% - 50px)' }}
        />
        <div
          className="absolute bg-[#62306D] w-[150px] h-[150px] right-0 rounded-full"
          style={{ top: 'calc(50% - 75px)' }}
        />
      </div>
    </div>
  );
};
