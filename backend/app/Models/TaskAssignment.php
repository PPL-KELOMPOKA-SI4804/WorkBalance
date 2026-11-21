<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TaskAssignment extends Model
{
    protected $table = 'task_assignments';

    protected $fillable = [
        'task_id',
        'employee_id',
        'assigned_by',
        'assigned_at',
        'deadline',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'assigned_at' => 'datetime',
            'deadline' => 'date:Y-m-d',
        ];
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class, 'task_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    public function assigner(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'assigned_by');
    }

    public function workLogs(): HasMany
    {
        return $this->hasMany(WorkLog::class, 'task_assignment_id');
    }
}
