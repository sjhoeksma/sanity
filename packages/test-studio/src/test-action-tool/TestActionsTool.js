import * as React from 'react'
// import actions from 'all:part:@sanity/base/document-action'
import resolveActions from 'part:@sanity/base/document-actions'
import {StateLink, withRouterHOC} from 'part:@sanity/base/router'
import documentStore from 'part:@sanity/base/datastore/document'
import {getPublishedId} from 'part:@sanity/base/util/draft-utils'

import {streamingComponent} from 'react-props-stream'
import {EMPTY, of} from 'rxjs'
import {distinctUntilChanged, map, tap, switchMap} from 'rxjs/operators'
import PopOverDialog from 'part:@sanity/components/dialogs/popover'
import Snackbar from 'part:@sanity/components/snackbar/default'
import Button from 'part:@sanity/components/buttons/default'
import schema from 'part:@sanity/base/schema'
import {RenderActionCollectionState} from 'part:@sanity/base/util/document-action-utils'

const RenderActionDialog = props => {
  return <PopOverDialog>{props.dialog}</PopOverDialog>
}

const RenderSnackbar = props => {
  return (
    <Snackbar
      kind={props.snackbar.type}
      actionTitle={props.snackbar.actionTitle}
      onAction={props.snackbar.onAction}
    >
      {props.snackbar.content}
    </Snackbar>
  )
}

const ActionButton = props => {
  const {actionState} = props
  const [key, setKey] = React.useState(Math.random())

  return (
    <>
      <Button
        loading={actionState.showActivityIndicator}
        onClick={actionState.handle}
        disabled={actionState.disabled}
      >
        {actionState.label}
      </Button>
      {/*Todo: reset state of others when handling one */}
      <button type="button" title="Clear state" onClick={() => setKey(Math.random())}>
        x
      </button>
      {actionState.dialog && <RenderActionDialog dialog={actionState.dialog} />}
      {actionState.snackbar && <RenderSnackbar snackbar={actionState.snackbar} />}
    </>
  )
}

function Footer(props) {
  return (
    <div>
      {props.actionStates.filter(Boolean).map((actionState, i) => (
        <ActionButton key={i} actionState={actionState} type={props.type} />
      ))}
    </div>
  )
}

function ActionMenu(props) {
  const actions = resolveActions(props.record, props.type)
  const [active, setActive] = React.useState(null)
  return (
    <div>
      {actions.map((action, i) => (
        <ActionButtonRenderer
          key={active ? `${active}-${i}` : i}
          action={action}
          record={props.record}
          onHandle
        />
      ))}
      <button onClick={() => setActive(null)}>Clear</button>
    </div>
  )
}

function UserSwitch() {
  const currentUser = useCurrentUser()
  const users = useUsers()
  return (
    users &&
    currentUser && (
      <>
        You are:{' '}
        <select value={currentUser.id} onChange={e => setCurrentUserId(e.currentTarget.value)}>
          {users.map(u => (
            <option value={u.id} key={u.id}>
              {u.displayName}
            </option>
          ))}
        </select>
      </>
    )
  )
}

const OtherEditor = streamingComponent(props$ => {
  return props$.pipe(
    switchMap(props => documentStore.local.editStateOf(props.id, props.type)),
    map(docState => <pre>{JSON.stringify(docState.draft, null, 2)}</pre>)
  )
})

const DocumentList = streamingComponent(props => {
  return documentStore.listenQuery(`*[defined(title)] {_id, _type, title} [100...121]`).pipe(
    map(result => {
      return (
        <div style={{overflow: 'auto'}}>
          <h2>Docs!</h2>
          <ul>
            {result.map(doc => (
              <li key={doc._id}>
                <StateLink state={{id: getPublishedId(doc._id), type: doc._type}}>
                  {doc.title}
                </StateLink>
              </li>
            ))}
          </ul>
        </div>
      )
    })
  )
})

export const TestActionsTool = withRouterHOC(
  streamingComponent(props$ => {
    return props$.pipe(
      map(props => props.router),
      switchMap(router => {
        if (!router.state.id) {
          router.navigate({id: `38552d45-143b-4909-9a7e-c5e52a798eb6`, type: 'arraysTest'})
          return EMPTY
        }
        return of([router.state.id, router.state.type])
      }),
      distinctUntilChanged(([id, type], [prevId, prevType]) => id === prevId && type === prevType),
      switchMap(([id, type]) => {
        const doc$ = documentStore.local.editStateOf(id, type)
        return doc$.pipe(
          map(editState => {
            return (
              <div style={{padding: '1em', display: 'flex', flexDirection: 'row'}}>
                <DocumentList />
                <div>
                  <h2>Now editing: {editState.id}</h2>
                  <pre style={{fontSize: '0.8em', height: 400, overflow: 'auto'}}>
                    {JSON.stringify(editState, null, 2)}
                  </pre>

                  <RenderActionCollectionState
                    component={Footer}
                    actions={resolveActions(editState, type)}
                    args={editState}
                    type={schema.get(type)}
                  />
                </div>
              </div>
            )
          })
        )
      })
    )
  })
)