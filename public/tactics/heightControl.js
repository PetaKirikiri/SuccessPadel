export function addHeightControl(preview){
  const slider=document.querySelector('#shot-height'),value=document.querySelector('#shot-height-value');
  slider.addEventListener('input',()=>preview.setHeight(Number(slider.value)));
  preview.onSetupChange(setup=>{
    slider.min=String(setup.minimumHeight);
    slider.value=String(setup.height);
    const label=`${setup.height.toFixed(1)}m`;
    value.textContent=label;
    slider.setAttribute('aria-valuetext',`${setup.height.toFixed(1)} metres over the net`);
  });
}
