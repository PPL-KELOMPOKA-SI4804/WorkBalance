<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Department extends Model
{
    protected $table = 'departments';

    protected $fillable = [
        'name',
        'code',
        'description',
        'manager_id',
    ];

    public function manager(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'manager_id');
    }

    public function employees(): HasMany
    {
        return $this->hasMany(Employee::class, 'department_id');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class, 'department_id');
    }

    public function decentWorkScores(): HasMany
    {
        return $this->hasMany(DecentWorkScore::class, 'department_id');
    }

    public function workplaceIssues(): HasMany
    {
        return $this->hasMany(WorkplaceIssue::class, 'department_id');
    }

    public function safetyIncidents(): HasMany
    {
        return $this->hasMany(SafetyIncident::class, 'department_id');
    }

    public function improvementActions(): HasMany
    {
        return $this->hasMany(ImprovementAction::class, 'department_id');
    }
}
