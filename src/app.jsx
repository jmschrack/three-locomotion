import { useMemo, useState } from 'preact/hooks'
import preactLogo from './assets/preact.svg'
import viteLogo from '/vite.svg'
import { FaSquare, FaCheckSquare, FaMinusSquare } from "react-icons/fa";
import './app.css'
import { FileUploader } from "react-drag-drop-files";
import { animationList, fileSignal, gltfSignal, legC, motionList } from './signals';
import TreeView, { flattenTree } from "react-accessible-treeview";
import { IoMdArrowDropright } from "react-icons/io";
import clsx from 'clsx';
import { Button, Card, Checkbox, Dialog, DialogBody, DialogFooter, DialogHeader, Option, Select, Slider, Typography } from '@material-tailwind/react';
import { SampleAnimation } from '../lib/util';

const TABLE_HEAD = ['', 'Left Leg', 'Right Leg']
const table_rows = { Thigh: 'LegUpper', Ankle: 'LegFoot', Toe: 'LegToe' };

export function App({ initializeLegController }) {
  const [count, setCount] = useState(0)
  const [openSelector, setOpenSelector] = useState(false);
  const [file, setFile] = useState(null);
  const handleChange = (file) => {
    //setFile(file);
    fileSignal.value = file;
  };
  const [animTime, setAnimTime] = useState(0)

  function onSlide(e) {


    const anim = animationList.value.find(a => a.getClip().name == "walking")
    //const time=e.currentTarget.value
    const time = anim.getClip().duration * (e.currentTarget.value / 100)
    setAnimTime(time);
    //console.log("Slide time",time,anim);
    SampleAnimation(anim, time);
    /* animationList.value.forEach(a=>a.stop().reset());
    anim.play();
    anim.time=time;
    anim.getMixer().time=time;
    anim.getMixer().update(0); */
  }
  return (
    <>

      <div class="card">
        <FileUploader handleChange={handleChange} name="file" types={['GLB']} />
      </div>
      <div>
        {gltfSignal.value && (
          <>

            <h2 className={'text-xl'}>Skeleton Setup for analysis</h2>
            <div className={'text-left'}>
              

              Root Node:<ChooseNode onChoose={(node) => { legC.transform = node }}> {legC.transform}</ChooseNode>
              <Card className="h-full w-full overflow-scroll">
                <table className="w-full min-w-max table-auto text-left">
                  <thead>
                    <tr>
                      {TABLE_HEAD.map((head) => (
                        <th
                          key={head}
                          className="border-b border-blue-gray-100 bg-blue-gray-50 p-4"
                        >
                          <Typography
                            variant="small"
                            color="blue-gray"
                            className="font-normal leading-none opacity-70"
                          >
                            {head}
                          </Typography>

                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(table_rows).map((k, index) => {
                      const isLast = index === 2;
                      const classes = isLast ? "p-4" : "p-4 border-b border-blue-gray-50";

                      return (
                        <tr key={`table-row-${k}`}>
                          <td className={classes}>
                            <Typography
                              variant="small"
                              color="blue-gray"
                              className="font-normal"
                            >
                              {k}
                            </Typography>
                          </td>
                          <td className={classes}>

                            <ChooseNode onChoose={(node) => { legC[`left${table_rows[k]}`] = node }}>{legC[`left${table_rows[k]}`]}</ChooseNode>
                          </td>
                          <td className={classes}>

                            <ChooseNode onChoose={(node) => { legC[`right${table_rows[k]}`] = node }}>{legC[`right${table_rows[k]}`]}</ChooseNode>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>


              {/*  <ChooseNode onChoose={(node) => { legC.leftLegUpper = node }}>Left Leg Hip {legC.leftLegUpper}</ChooseNode>
              <ChooseNode onChoose={(node) => { legC.leftLegFoot = node }}>Left Leg Ankle {legC.leftLegFoot}</ChooseNode>
              <ChooseNode onChoose={(node) => { legC.leftLegToe = node }}>Left Leg Toe {legC.leftLegToe}</ChooseNode>
              <ChooseNode onChoose={(node) => { legC.rightLegUpper = node }}>Right Leg Hip {legC.rightLegUpper}</ChooseNode>
              <ChooseNode onChoose={(node) => { legC.rightLegFoot = node }}>Right Leg Ankle {legC.rightLegFoot}</ChooseNode>
              <ChooseNode onChoose={(node) => { legC.rightLegToe = node }}>Right Leg Toe {legC.rightLegToe}</ChooseNode> */}

              
            </div>
            <div className='text-left'>
              <h2 className={'text-xl'}>Animations for Analysis</h2>
              Grounded Pose: <AnimationSelect key={'grounded_pose'} onChange={(a) => legC.groundedPose = a} value={legC.groundedPose} />
              {animationList.value.map((anim, index) => (<Checkbox key={`anim_${index}`} checked={anim.checked??false} onChange={(e) => {anim.checked=e.currentTarget.checked}} label={anim.getClip().name}/>))}
            </div>
            <Button onClick={initializeLegController}>Initialize</Button>
            {motionList.value?.length&&(
            <div className='text-left'>
              {motionList.value.map((motion, index) => (
                <>
                  <Typography key={`motion_${index}`} variant="lead" className="font-normal">{motion.name}</Typography>
                <Typography variant="small" className="font-normal">Natural Speed: {motion.nativeSpeed.toFixed(2)}m/s</Typography>

                </>
              ))}
              </div>)}
          </>
        )}
      </div>
      <p class="read-the-docs">
        Click on the Vite and Preact logos to learn more
      </p>
    </>
  )
}
const ArrowIcon = ({ isOpen, className }) => {
  const baseClass = "arrow inline-flex";
  const classes = clsx(
    baseClass,
    { [`${baseClass}--closed`]: !isOpen },
    { [`${baseClass}--open`]: isOpen },
    className
  );
  return <IoMdArrowDropright className={classes} />;
};


function AnimationSelect({ key, onChange, value }) {
  function onSelect(value) {
    if (value == "None") onChange(null);
    onChange(animationList.value.find(a => a.getClip().name == value));
  }
  const options = useMemo(() => {
    const l = animationList.value.map((anim, index) => anim.getClip().name)
    l.unshift("None");
    return l;
  }, [animationList.value]);
  return (
    <Select label="Choose Animation" onChange={onSelect} value={`${options.find(a => a == value) ?? 'None'}`}>

      {options.map((anim, index) => (
        <Option key={`select_${key}_${anim}`} value={anim}>{anim}</Option>
      ))}
    </Select>
  )
}

function ChooseNode({ onChoose, children }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <Button className='normal-case' variant='text' color='light-blue' onClick={() => setShow(true)}>{children}</Button>
      <NodeSelector show={show} onChoose={(node) => { onChoose(node); setShow(false) }} />
    </>
  )
}

function NodeSelector({ show, onChoose, value }) {
  const [selected, setSelected] = useState(null);
  return (
    <Dialog open={show}>
      <DialogHeader>Choose Node</DialogHeader>
      <DialogBody>
        <TreeView
          data={flattenTree(gltfSignal.value.scene)}
          className="basic"
          aria-label="basic example tree"
          multiSelect={false}
          togglableSelect={true}
          onNodeSelect={(node) => { setSelected(node.element.name) }}
          nodeRenderer={({
            element,
            isBranch,
            isExpanded,
            isDisabled,
            getNodeProps,
            level,
            handleExpand,
            handleSelect,
            isSelected,
            isHalfSelected
          }) => {
            return (
              <div
                {...getNodeProps({ onClick: handleExpand })}
                style={{
                  marginLeft: 40 * (level - 1),
                  opacity: isDisabled ? 0.5 : 1,
                }}
                className={'flex'}
              >
                {isBranch && <ArrowIcon isOpen={isExpanded} />}

                <CheckBoxIcon
                  className="checkbox-icon"
                  onClick={(e) => {
                    handleSelect(e);
                    e.stopPropagation();
                  }}
                  variant={
                    isHalfSelected ? "some" : isSelected ? "all" : "none"
                  }
                />
                <span className="name">
                  {element.name}
                </span>
              </div>
            );
          }}
        />
      </DialogBody>
      <DialogFooter>
        <Button color="red" onClick={() => onChoose(selected)}>Save</Button>
      </DialogFooter>
    </Dialog>


  )
}

const CheckBoxIcon = ({ variant, ...rest }) => {
  switch (variant) {
    case "all":
      return <FaCheckSquare {...rest} />;
    case "none":
      return <FaSquare {...rest} />;
    case "some":
      return <FaMinusSquare {...rest} />;
    default:
      return null;
  }
};